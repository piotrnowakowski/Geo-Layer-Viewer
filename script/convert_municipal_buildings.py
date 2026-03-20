#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
DEFAULT_INPUT = "pv_panel_data/Municipal_buildings.xlsx"
DEFAULT_OUTPUT = "pv_panel_data/Municipal_buildings.geocoded.json"
DEFAULT_CACHE = "pv_panel_data/.cache/Municipal_buildings.geocode-cache.json"
DEFAULT_DELAY_MS = 100
ARCGIS_URL = (
    "https://geocode.arcgis.com/arcgis/rest/services/"
    "World/GeocodeServer/findAddressCandidates"
)
USER_AGENT = "Geo-Layer-Viewer municipal geocoder/1.0"


@dataclass
class InputRecord:
    item: int
    utilized_by: str
    street: str
    number: str
    neighborhood: str


last_request_at = 0.0


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def expand_street_prefix(value: str) -> str:
    normalized = normalize_whitespace(value)
    replacements: list[tuple[str, str]] = [
        (r"^R\b\.?\s+", "Rua "),
        (r"^AV\b\.?\s+", "Avenida "),
        (r"^TV\b\.?\s+", "Travessa "),
        (r"^EST\b\.?\s+", "Estrada "),
        (r"^AL\b\.?\s+", "Alameda "),
        (r"^PCA\b\.?\s+", "Praca "),
        (r"^PC\b\.?\s+", "Praca "),
        (r"^ROD\b\.?\s+", "Rodovia "),
        (r"^LGO\b\.?\s+", "Largo "),
    ]
    for pattern, replacement in replacements:
        if re.search(pattern, normalized, flags=re.IGNORECASE):
            return re.sub(pattern, replacement, normalized, flags=re.IGNORECASE)
    return normalized


def normalize_match_text(value: str | None) -> str:
    if not value:
        return ""
    text = normalize_whitespace(value)
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\bR\b", "RUA", text, flags=re.UNICODE)
    text = re.sub(r"\bAV\b", "AVENIDA", text, flags=re.UNICODE)
    text = re.sub(r"\bTV\b", "TRAVESSA", text, flags=re.UNICODE)
    text = re.sub(r"\bEST\b", "ESTRADA", text, flags=re.UNICODE)
    text = re.sub(r"\bAL\b", "ALAMEDA", text, flags=re.UNICODE)
    text = re.sub(r"\bPCA\b", "PRACA", text, flags=re.UNICODE)
    text = re.sub(r"\bPC\b", "PRACA", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text, flags=re.UNICODE)
    return text.strip().upper()


def parse_number_candidates(raw_number: str) -> list[str]:
    normalized = normalize_whitespace(raw_number).upper()
    if normalized in ("", "SN", "S/N"):
        return []
    candidates: list[str] = []
    for part in normalized.split("/"):
        candidates.extend(re.findall(r"\d+[A-Z]?", part))
    unique: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        if candidate not in seen:
            unique.append(candidate)
            seen.add(candidate)
    return unique


def build_address_text(record: InputRecord) -> str:
    parts = [
        expand_street_prefix(record.street),
        record.number if record.number.upper() not in ("", "SN", "S/N") else None,
        record.neighborhood,
        "Porto Alegre",
        "Rio Grande do Sul",
        "Brazil",
    ]
    return ", ".join(part for part in parts if part)


def build_candidate_queries(record: InputRecord) -> list[dict[str, str | None]]:
    street = expand_street_prefix(record.street)
    neighborhood = normalize_whitespace(record.neighborhood)
    queries: list[dict[str, str | None]] = []

    for number in parse_number_candidates(record.number):
        queries.append(
            {
                "label": f"address:{number}",
                "query": f"{street}, {number}, {neighborhood}, Porto Alegre, Rio Grande do Sul, Brazil",
                "number_used": number,
            }
        )

    queries.append(
        {
            "label": "street+neighborhood",
            "query": f"{street}, {neighborhood}, Porto Alegre, Rio Grande do Sul, Brazil",
            "number_used": None,
        }
    )
    queries.append(
        {
            "label": "street+city",
            "query": f"{street}, Porto Alegre, Rio Grande do Sul, Brazil",
            "number_used": None,
        }
    )

    deduped: list[dict[str, str | None]] = []
    seen: set[str] = set()
    for query in queries:
        key = json.dumps(query, sort_keys=True)
        if key not in seen:
            deduped.append(query)
            seen.add(key)
    return deduped


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    ensure_parent(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def wait_for_slot(delay_ms: int) -> None:
    global last_request_at
    wait_seconds = (last_request_at + delay_ms / 1000.0) - time.time()
    if wait_seconds > 0:
        time.sleep(wait_seconds)
    last_request_at = time.time()


def read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for item in root.findall("a:si", NS):
        text = "".join(node.text or "" for node in item.findall(".//a:t", NS))
        values.append(text)
    return values


def parse_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    cell_type = cell.get("t")
    value_node = cell.find("a:v", NS)
    inline_node = cell.find("a:is", NS)

    if cell_type == "s" and value_node is not None and value_node.text:
        return shared_strings[int(value_node.text)]
    if cell_type == "inlineStr" and inline_node is not None:
        return "".join(node.text or "" for node in inline_node.findall(".//a:t", NS))
    if value_node is not None and value_node.text is not None:
        return value_node.text
    return ""


def read_workbook_rows(path: Path) -> list[InputRecord]:
    with zipfile.ZipFile(path) as zf:
        shared_strings = read_shared_strings(zf)
        sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))
        rows = sheet.findall(".//a:sheetData/a:row", NS)
        if len(rows) < 2:
            raise ValueError("Workbook does not contain the expected header row")

        header_cells = rows[1].findall("a:c", NS)
        headers: list[str] = [parse_cell_value(cell, shared_strings) for cell in header_cells]
        header_map: dict[str, int] = {header: index for index, header in enumerate(headers)}

        required_headers = ["ITEM", "UTILIZADO_", "LOGRADOURO", "NUMERO", "BAIRRO"]
        missing_headers = [header for header in required_headers if header not in header_map]
        if missing_headers:
            raise ValueError(f"Missing workbook headers: {', '.join(missing_headers)}")

        records: list[InputRecord] = []
        for row in rows[2:]:
            row_values = [""] * len(headers)
            for cell in row.findall("a:c", NS):
                ref = cell.get("r", "")
                column_letters = "".join(ch for ch in ref if ch.isalpha())
                column_index = excel_col_to_index(column_letters)
                if 0 <= column_index < len(row_values):
                    row_values[column_index] = parse_cell_value(cell, shared_strings)

            item_raw = row_values[header_map["ITEM"]]
            if not str(item_raw).strip():
                continue

            records.append(
                InputRecord(
                    item=int(float(item_raw)),
                    utilized_by=normalize_whitespace(row_values[header_map["UTILIZADO_"]]),
                    street=normalize_whitespace(row_values[header_map["LOGRADOURO"]]),
                    number=normalize_whitespace(row_values[header_map["NUMERO"]]),
                    neighborhood=normalize_whitespace(row_values[header_map["BAIRRO"]]),
                )
            )
        return records


def excel_col_to_index(column_letters: str) -> int:
    index = 0
    for char in column_letters:
        index = index * 26 + (ord(char.upper()) - ord("A") + 1)
    return index - 1


def arcgis_precision(candidate: dict[str, Any]) -> str:
    addr_type = str(candidate.get("attributes", {}).get("Addr_type", "") or "")
    if addr_type in ("StreetAddress", "PointAddress", "Subaddress"):
        return "address"
    if addr_type in ("StreetName", "StreetInt"):
        return "street"
    if addr_type:
        return "area"
    return "unknown"


def score_arcgis_candidate(candidate: dict[str, Any], query: dict[str, Any], record: InputRecord) -> int:
    score = int(round(float(candidate.get("score", 0)) / 2))
    attributes = candidate.get("attributes", {}) or {}
    matched_label = (
        attributes.get("LongLabel")
        or attributes.get("Match_addr")
        or candidate.get("address")
        or ""
    )
    matched_text = normalize_match_text(str(matched_label))
    street_bits = " ".join(
        part
        for part in [
            str(attributes.get("StPreType", "") or ""),
            str(attributes.get("StName", "") or ""),
        ]
        if part
    )
    matched_street = normalize_match_text(street_bits or str(attributes.get("StAddr", "") or ""))
    input_street = normalize_match_text(expand_street_prefix(record.street))
    neighborhood = normalize_match_text(record.neighborhood)
    district = normalize_match_text(str(attributes.get("District", "") or ""))

    if matched_street and (matched_street in input_street or input_street in matched_street):
        score += 35
    if neighborhood and (neighborhood in district or neighborhood in matched_text):
        score += 20
    if "PORTO ALEGRE" in matched_text:
        score += 10
    if query.get("number_used"):
        pattern = rf"\b{re.escape(str(query['number_used']))}\b"
        if re.search(pattern, matched_text):
            score += 15
    if arcgis_precision(candidate) == "address":
        score += 20
    return score


def fetch_arcgis_candidates(query_text: str, cache: dict[str, Any], cache_path: Path, delay_ms: int) -> list[dict[str, Any]]:
    cache_key = normalize_whitespace(query_text)
    cached = cache["geocode"].get(cache_key)
    if cached:
        return cached["candidates"]

    wait_for_slot(delay_ms)
    params = {
        "f": "json",
        "maxLocations": "5",
        "outFields": ",".join(
            [
                "Addr_type",
                "AddNum",
                "City",
                "Country",
                "District",
                "LongLabel",
                "Match_addr",
                "Postal",
                "Rank",
                "Region",
                "ShortLabel",
                "StAddr",
                "StName",
                "StPreType",
                "Status",
            ]
        ),
        "sourceCountry": "BRA",
        "SingleLine": query_text,
    }
    url = f"{ARCGIS_URL}?{urllib.parse.urlencode(params)}"

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                },
            )
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
            candidates = payload.get("candidates", [])
            cache["geocode"][cache_key] = {
                "savedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "candidates": candidates,
            }
            write_json(cache_path, cache)
            return candidates
        except Exception as exc:
            last_error = exc
            time.sleep(attempt + 1)
    raise RuntimeError(f"ArcGIS geocoding failed for query '{query_text}': {last_error}")


def choose_best_match(record: InputRecord, cache: dict[str, Any], cache_path: Path, delay_ms: int) -> tuple[dict[str, Any] | None, list[str], dict[str, Any] | None]:
    attempts: list[str] = []
    best_candidate: dict[str, Any] | None = None
    best_query: dict[str, Any] | None = None
    best_score = -1

    for query in build_candidate_queries(record):
        attempts.append(str(query["query"]))
        candidates = fetch_arcgis_candidates(str(query["query"]), cache, cache_path, delay_ms)
        for candidate in candidates:
            score = score_arcgis_candidate(candidate, query, record)
            if score > best_score:
                best_candidate = candidate
                best_query = query
                best_score = score

        if best_candidate:
            matched_label = (
                best_candidate.get("attributes", {}).get("LongLabel")
                or best_candidate.get("address")
                or ""
            )
            matched_text = normalize_match_text(str(matched_label))
            if best_score >= 95 or (
                arcgis_precision(best_candidate) == "address"
                and (
                    not record.neighborhood
                    or normalize_match_text(record.neighborhood) in matched_text
                )
            ):
                break

    return best_candidate, attempts, best_query


def record_to_output(record: InputRecord, match: dict[str, Any] | None, attempts: list[str], best_query: dict[str, Any] | None) -> dict[str, Any]:
    address = {
        "street": expand_street_prefix(record.street),
        "number": record.number,
        "neighborhood": record.neighborhood,
        "city": "Porto Alegre",
        "state": "Rio Grande do Sul",
        "country": "Brazil",
        "formatted": build_address_text(record),
    }

    if not match:
        return {
            "item": record.item,
            "utilizedBy": record.utilized_by,
            "address": address,
            "location": None,
            "match": {
                "status": "not_found",
                "attempts": attempts,
            },
        }

    attributes = match.get("attributes", {}) or {}
    return {
        "item": record.item,
        "utilizedBy": record.utilized_by,
        "address": address,
        "location": {
            "latitude": match["location"]["y"],
            "longitude": match["location"]["x"],
            "precision": arcgis_precision(match),
            "source": "ArcGIS World Geocoding Service",
        },
        "match": {
            "status": "matched",
            "queryUsed": best_query["query"] if best_query else None,
            "matchedAddress": attributes.get("LongLabel")
            or attributes.get("Match_addr")
            or match.get("address"),
            "provider": "ArcGIS World Geocoding Service",
            "score": match.get("score"),
            "addrType": attributes.get("Addr_type"),
            "district": attributes.get("District"),
            "postalCode": attributes.get("Postal"),
        },
    }


def build_output(records: list[dict[str, Any]], input_path: Path, output_path: Path, cache_path: Path, delay_ms: int) -> dict[str, Any]:
    matched = sum(1 for record in records if record["location"] is not None)
    return {
        "metadata": {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "inputPath": str(input_path),
            "outputPath": str(output_path),
            "cachePath": str(cache_path),
            "geocoder": "ArcGIS World Geocoding Service",
            "delayMs": delay_ms,
            "totalRows": len(records),
            "matchedRows": matched,
            "unmatchedRows": len(records) - matched,
        },
        "records": records,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert municipal buildings XLSX to geocoded JSON")
    parser.add_argument("--input", default=DEFAULT_INPUT)
    parser.add_argument("--out", default=DEFAULT_OUTPUT)
    parser.add_argument("--cache", default=DEFAULT_CACHE)
    parser.add_argument("--delay-ms", type=int, default=DEFAULT_DELAY_MS)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--start-at", type=int, default=1)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.out).resolve()
    cache_path = Path(args.cache).resolve()

    cache = read_json(cache_path, {"geocode": {}})
    if "geocode" not in cache:
        cache = {"geocode": {}}

    records = read_workbook_rows(input_path)
    start_index = max(0, args.start_at - 1)
    selected = records[start_index:]
    if args.limit is not None:
        selected = selected[: args.limit]

    print(f"Processing {len(selected)} rows from {input_path.relative_to(Path.cwd())}")

    output_records: list[dict[str, Any]] = []
    for index, record in enumerate(selected, start=1):
        match, attempts, best_query = choose_best_match(record, cache, cache_path, args.delay_ms)
        output_records.append(record_to_output(record, match, attempts, best_query))

        if index % 25 == 0 or index == len(selected):
            partial_output = build_output(output_records, input_path, output_path, cache_path, args.delay_ms)
            write_json(output_path, partial_output)
            matched_rows = sum(1 for item in output_records if item["location"] is not None)
            print(f"Processed {index}/{len(selected)} rows ({matched_rows} with coordinates)")

    final_output = build_output(output_records, input_path, output_path, cache_path, args.delay_ms)
    write_json(output_path, final_output)
    print(f"Wrote {len(output_records)} records to {output_path}")
    print(
        f"Matched {final_output['metadata']['matchedRows']} rows; "
        f"{final_output['metadata']['unmatchedRows']} rows need manual review."
    )


if __name__ == "__main__":
    main()

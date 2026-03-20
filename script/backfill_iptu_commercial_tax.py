from __future__ import annotations

import csv
import json
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE_CSV = ROOT / "iptu" / "iptu_2025_neighbourhood_total_tax.csv"
TARGET_FILES = [
    ROOT / "data" / "iptu" / "poa_iptu_commercial_tax.geojson",
    ROOT / "client" / "public" / "sample-data" / "poa-iptu-commercial-tax.geojson",
]


def normalize_name(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    for token in ("-", "'", ",", "."):
        ascii_value = ascii_value.replace(token, " ")
    return " ".join(ascii_value.split())


# TODO: Replace this alias map with a code-based join once the commercial IPTU
# pipeline has stable neighbourhood IDs from the city source. These values are
# still sourced from the official city totals CSV above; only the name matching
# is manual here because of truncation/abbreviation mismatches.
CSV_NAME_ALIASES = {
    "aberta dos morros": "ABERTA DOS MORR",
    "boa vista do sul": "BOA VISTA DO SU",
    "centro historico": "CENTRO HISTORIC",
    "chacara das pedras": "CHACARA PEDRAS",
    "coronel aparicio borges": "CEL AP BORGES",
    "jardim leopoldina": "JAR LEOPOLDINA",
    "jardim sao pedro": "JAR SAO PEDRO",
    "lomba do pinheiro": "LOMBA PINHEIRO",
    "menino deus": "MENINO DEUS",
    "moinhos de vento": "MOINHOS VENTO",
    "montserrat": "MONT SERRAT",
    "parque santa fe": "PARQUE STA FE",
    "passo das pedras": "PASSO DAS PEDRA",
    "santa maria goretti": "SANTA M GORETTI",
    "santa rosa de lima": "STA ROSA LIMA",
    "vila joao pessoa": "VL JOAO PESSOA",
}


def load_city_totals() -> dict[str, float]:
    with SOURCE_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        return {
            row["NME_ENDLOC_BAIRRO_CDL"]: float(row["TOTAL_TAX"])
            for row in reader
            if row["NME_ENDLOC_BAIRRO_CDL"] and row["TOTAL_TAX"]
        }


def resolve_total_tax(neighbourhood_name: str, city_totals: dict[str, float]) -> float | None:
    normalized_name = normalize_name(neighbourhood_name)

    for city_name, total in city_totals.items():
        if normalize_name(city_name) == normalized_name:
            return total

    alias_name = CSV_NAME_ALIASES.get(normalized_name)
    if alias_name is None:
        return None

    return city_totals.get(alias_name)


def backfill_file(file_path: Path, city_totals: dict[str, float]) -> tuple[int, list[str]]:
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    patched = 0
    unresolved: list[str] = []

    for feature in payload.get("features", []):
        properties = feature.get("properties", {})
        if properties.get("iptu_total_tax") is not None:
            continue

        neighbourhood_name = str(properties.get("neighbourhood_name") or "").strip()
        if not neighbourhood_name:
            unresolved.append("<missing neighbourhood_name>")
            continue

        resolved_total = resolve_total_tax(neighbourhood_name, city_totals)
        if resolved_total is None:
            unresolved.append(neighbourhood_name)
            continue

        properties["iptu_total_tax"] = round(resolved_total, 2)
        commercial_buildings = properties.get("commercial_buildings_count") or 0
        if isinstance(commercial_buildings, (int, float)) and commercial_buildings > 0:
            properties["tax_per_commercial_building"] = round(
                resolved_total / commercial_buildings,
                2,
            )
        else:
            properties["tax_per_commercial_building"] = None
        patched += 1

    file_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return patched, unresolved


def main() -> None:
    city_totals = load_city_totals()
    had_error = False

    for target_file in TARGET_FILES:
        patched, unresolved = backfill_file(target_file, city_totals)
        print(f"{target_file.relative_to(ROOT)}: patched {patched} feature(s)")
        if unresolved:
            had_error = True
            print(f"  unresolved: {', '.join(sorted(set(unresolved)))}")

    if had_error:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

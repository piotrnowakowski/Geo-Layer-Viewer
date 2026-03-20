# file: export_poa_iptu_bairros_2026.py

import csv
import json
import shutil
import subprocess
import sys
import urllib.parse

RESOURCE_ID = "1129ea5b-bf51-4102-a115-756343e86d27"
OUTPUT_CSV = "poa_iptu_bairros_2026.csv"

# Agregacja IPTU/TCL po bairro.
# To są wartości naliczone z datasetu IPTU, nie "rzeczywiście zapłacone"
# z widoku /smf/iptu/bairros.
SQL = f"""
SELECT
  "NME_ENDLOC_BAIRRO_CDL" AS bairro,
  SUM(COALESCE("VLR_IMPOSTO", 0)) AS iptu_lancado_rs,
  SUM(COALESCE("VLR_TCL", 0)) AS tcl_rs,
  SUM(COALESCE("VLR_IMPOSTO", 0) + COALESCE("VLR_TCL", 0)) AS total_rs,
  COUNT(*) AS registros
FROM "{RESOURCE_ID}"
WHERE "NME_ENDLOC_BAIRRO_CDL" IS NOT NULL
GROUP BY 1
ORDER BY total_rs DESC
""".strip()

API_URL = (
    "https://dadosabertos.poa.br/api/3/action/datastore_search_sql?sql="
    + urllib.parse.quote(SQL)
)


def fetch_json_with_requests(url: str) -> dict:
    """
    Próba pobrania JSON przez requests.
    To zadziała tylko jeśli środowisko ma poprawne wsparcie HTTPS/SSL.
    """
    import requests  # import lokalny, żeby skrypt nie padał jeśli requests nie ma

    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    return resp.json()


def fetch_json_with_curl(url: str) -> dict:
    """
    Fallback przez curl. Często działa nawet gdy Python w środowisku
    nie ma poprawnie skonfigurowanego SSL.
    """
    if shutil.which("curl") is None:
        raise RuntimeError("curl is not available in this environment")

    cmd = [
        "curl",
        "-L",          # follow redirects
        "--fail",      # fail on HTTP errors
        "--silent",
        "--show-error",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def fetch_payload(url: str) -> dict:
    """
    Najpierw requests, potem curl.
    """
    first_error = None

    # Attempt 1: requests
    try:
        return fetch_json_with_requests(url)
    except Exception as e:
        first_error = e
        print(f"[WARN] requests failed: {e}", file=sys.stderr)

    # Attempt 2: curl
    try:
        return fetch_json_with_curl(url)
    except Exception as e:
        print(f"[WARN] curl failed: {e}", file=sys.stderr)
        raise RuntimeError(
            "Could not fetch data from the CKAN API.\n"
            f"requests error: {first_error}\n"
            f"curl error: {e}\n"
            "This likely means the execution environment has no outbound HTTPS access."
        )


def write_csv(records: list[dict], output_csv: str) -> None:
    """
    Zapis wyników do CSV.
    """
    fieldnames = ["bairro", "iptu_lancado_rs", "tcl_rs", "total_rs", "registros"]

    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for row in records:
            writer.writerow(
                {
                    "bairro": row.get("bairro"),
                    "iptu_lancado_rs": row.get("iptu_lancado_rs"),
                    "tcl_rs": row.get("tcl_rs"),
                    "total_rs": row.get("total_rs"),
                    "registros": row.get("registros"),
                }
            )


def main() -> None:
    print("Fetching CKAN payload...")
    payload = fetch_payload(API_URL)

    if not payload.get("success"):
        raise RuntimeError(f"CKAN API returned success=false: {payload}")

    records = payload["result"]["records"]
    print(f"Fetched {len(records)} bairro rows")

    write_csv(records, OUTPUT_CSV)
    print(f"CSV written to: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
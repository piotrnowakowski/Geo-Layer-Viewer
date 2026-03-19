import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

type WorkbookRow = {
  ITEM?: string | number;
  UTILIZADO_?: string;
  LOGRADOURO?: string;
  NUMERO?: string | number;
  BAIRRO?: string;
};

type InputRecord = {
  item: number;
  utilizedBy: string;
  street: string;
  number: string;
  neighborhood: string;
};

type CandidateQuery = {
  label: string;
  query: string;
  numberUsed: string | null;
};

type NominatimResult = {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  category?: string;
  type?: string;
  place_rank?: number;
  importance?: number;
  addresstype?: string;
  display_name: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
};

type CacheEntry = {
  savedAt: string;
  results: NominatimResult[];
};

type GeocodeCache = Record<string, CacheEntry>;

type SiteType = "building" | "plot_of_land" | "unknown";
type LocationPrecision = "building" | "street" | "area" | "unknown";

type OutputRecord = {
  item: number;
  utilizedBy: string;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: "Porto Alegre";
    state: "Rio Grande do Sul";
    country: "Brazil";
    formatted: string;
  };
  location: {
    latitude: number;
    longitude: number;
    precision: LocationPrecision;
    source: "OpenStreetMap Nominatim";
  } | null;
  siteType: SiteType;
  siteTypeReason: string | null;
  match:
    | {
        status: "matched";
        queryUsed: string;
        matchedDisplayName: string;
        category: string | null;
        type: string | null;
        addresstype: string | null;
        osmType: string | null;
        osmId: number | null;
        importance: number | null;
        placeRank: number | null;
        score: number;
      }
    | {
        status: "not_found";
        attempts: string[];
      };
};

type ScriptOutput = {
  metadata: {
    generatedAt: string;
    inputPath: string;
    outputPath: string;
    cachePath: string;
    geocoder: "OpenStreetMap Nominatim";
    delayMs: number;
    totalRows: number;
    matchedRows: number;
    unmatchedRows: number;
    buildingRows: number;
    plotOfLandRows: number;
    unknownSiteTypeRows: number;
  };
  records: OutputRecord[];
};

type CliOptions = {
  inputPath: string;
  outputPath: string;
  cachePath: string;
  delayMs: number;
  limit: number | null;
  startAt: number;
};

const DEFAULT_INPUT_PATH = "pv_panel_data/Municipal_buildings.xlsx";
const DEFAULT_OUTPUT_PATH = "pv_panel_data/Municipal_buildings.geocoded.json";
const DEFAULT_CACHE_PATH =
  "pv_panel_data/.cache/Municipal_buildings.geocode-cache.json";
const DEFAULT_DELAY_MS = 1100;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_SOURCE = "OpenStreetMap Nominatim" as const;
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "Geo-Layer-Viewer municipal geocoder/1.0";

let lastNetworkRequestAt = 0;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputPath: DEFAULT_INPUT_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    cachePath: DEFAULT_CACHE_PATH,
    delayMs: DEFAULT_DELAY_MS,
    limit: null,
    startAt: 1,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--input" && next) {
      options.inputPath = next;
      index += 1;
      continue;
    }

    if (arg === "--out" && next) {
      options.outputPath = next;
      index += 1;
      continue;
    }

    if (arg === "--cache" && next) {
      options.cachePath = next;
      index += 1;
      continue;
    }

    if (arg === "--delay-ms" && next) {
      options.delayMs = Number(next);
      index += 1;
      continue;
    }

    if (arg === "--limit" && next) {
      options.limit = Number(next);
      index += 1;
      continue;
    }

    if (arg === "--start-at" && next) {
      options.startAt = Number(next);
      index += 1;
      continue;
    }

    if (arg === "--help") {
      console.log(
        [
          "Usage: npm run pv:municipal-buildings -- [options]",
          "",
          "Options:",
          "  --input <path>      Excel workbook path",
          "  --out <path>        JSON output path",
          "  --cache <path>      Geocoder cache path",
          "  --delay-ms <ms>     Delay between network requests",
          "  --limit <n>         Process only the first n rows after --start-at",
          "  --start-at <n>      Start from workbook row n (1-based data row)",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }

  if (
    options.limit !== null &&
    (!Number.isFinite(options.limit) || options.limit <= 0)
  ) {
    throw new Error("--limit must be a positive number");
  }

  if (!Number.isFinite(options.startAt) || options.startAt <= 0) {
    throw new Error("--start-at must be a positive number");
  }

  return options;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function expandStreetPrefix(value: string): string {
  const normalized = normalizeWhitespace(value);
  const replacements: Array<[RegExp, string]> = [
    [/^R\b\.?\s+/i, "Rua "],
    [/^AV\b\.?\s+/i, "Avenida "],
    [/^TV\b\.?\s+/i, "Travessa "],
    [/^EST\b\.?\s+/i, "Estrada "],
    [/^AL\b\.?\s+/i, "Alameda "],
    [/^PCA\b\.?\s+/i, "Praca "],
    [/^PC\b\.?\s+/i, "Praca "],
    [/^ROD\b\.?\s+/i, "Rodovia "],
    [/^LGO\b\.?\s+/i, "Largo "],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, replacement);
    }
  }

  return normalized;
}

function normalizeMatchText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\bR\b/gu, "RUA")
    .replace(/\bAV\b/gu, "AVENIDA")
    .replace(/\bTV\b/gu, "TRAVESSA")
    .replace(/\bEST\b/gu, "ESTRADA")
    .replace(/\bAL\b/gu, "ALAMEDA")
    .replace(/\bPCA\b/gu, "PRACA")
    .replace(/\bPC\b/gu, "PRACA")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function parseNumberCandidates(rawNumber: string): string[] {
  const normalized = normalizeWhitespace(rawNumber).toUpperCase();
  if (!normalized || normalized === "SN" || normalized === "S/N") {
    return [];
  }

  const candidates = normalized
    .split("/")
    .flatMap((part) => part.match(/\d+[A-Z]?/g) ?? [])
    .map((part) => part.trim())
    .filter(Boolean);

  return unique(candidates);
}

function buildAddressText(record: InputRecord): string {
  const parts = [
    expandStreetPrefix(record.street),
    record.number && record.number.toUpperCase() !== "SN" ? record.number : null,
    record.neighborhood,
    "Porto Alegre",
    "Rio Grande do Sul",
    "Brazil",
  ].filter(Boolean);

  return parts.join(", ");
}

function buildCandidateQueries(record: InputRecord): CandidateQuery[] {
  const street = expandStreetPrefix(record.street);
  const neighborhood = normalizeWhitespace(record.neighborhood);
  const numberCandidates = parseNumberCandidates(record.number);
  const queries: CandidateQuery[] = [];

  for (const number of numberCandidates) {
    queries.push({
      label: `address:${number}`,
      numberUsed: number,
      query: `${street}, ${number}, ${neighborhood}, Porto Alegre, Rio Grande do Sul, Brazil`,
    });
  }

  queries.push({
    label: "street+neighborhood",
    numberUsed: null,
    query: `${street}, ${neighborhood}, Porto Alegre, Rio Grande do Sul, Brazil`,
  });

  queries.push({
    label: "street+city",
    numberUsed: null,
    query: `${street}, Porto Alegre, Rio Grande do Sul, Brazil`,
  });

  return unique(queries.map((query) => JSON.stringify(query))).map(
    (query) => JSON.parse(query) as CandidateQuery,
  );
}

async function ensureDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await ensureDirectory(filePath);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function waitForRequestSlot(delayMs: number): Promise<void> {
  const waitMs = lastNetworkRequestAt + delayMs - Date.now();
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastNetworkRequestAt = Date.now();
}

async function fetchNominatim(
  query: string,
  cache: GeocodeCache,
  cachePath: string,
  delayMs: number,
): Promise<NominatimResult[]> {
  const cacheKey = normalizeWhitespace(query);
  const cached = cache[cacheKey];
  if (cached) {
    return cached.results;
  }

  await waitForRequestSlot(delayMs);

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  if (process.env.NOMINATIM_EMAIL) {
    url.searchParams.set("email", process.env.NOMINATIM_EMAIL);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
          "user-agent": USER_AGENT,
        },
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Nominatim responded with ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Nominatim responded with ${response.status}`);
      }

      const results = (await response.json()) as NominatimResult[];
      cache[cacheKey] = {
        savedAt: new Date().toISOString(),
        results,
      };
      await writeJsonFile(cachePath, cache);
      return results;
    } catch (error) {
      lastError = error as Error;
      await sleep(1000 * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Unknown Nominatim error");
}

function getResultAddressValues(result: NominatimResult): string[] {
  const address = result.address ?? {};
  return Object.values(address).filter(Boolean);
}

function isRoadLevel(result: NominatimResult): boolean {
  return result.addresstype === "road" || result.category === "highway";
}

function scoreResult(
  result: NominatimResult,
  candidate: CandidateQuery,
  record: InputRecord,
): number {
  let score = 0;

  const roadText = normalizeMatchText(
    result.address?.road ?? result.address?.pedestrian ?? result.name ?? "",
  );
  const streetText = normalizeMatchText(expandStreetPrefix(record.street));
  const neighborhoodText = normalizeMatchText(record.neighborhood);
  const addressValues = getResultAddressValues(result)
    .map((value) => normalizeMatchText(value))
    .join(" ");
  const displayText = normalizeMatchText(result.display_name);

  if (displayText.includes("PORTO ALEGRE")) {
    score += 20;
  }

  if (roadText && (roadText.includes(streetText) || streetText.includes(roadText))) {
    score += 35;
  }

  if (
    neighborhoodText &&
    (addressValues.includes(neighborhoodText) || displayText.includes(neighborhoodText))
  ) {
    score += 25;
  }

  if (candidate.numberUsed && new RegExp(`\\b${candidate.numberUsed}\\b`, "u").test(displayText)) {
    score += 15;
  }

  if (
    result.category === "building" ||
    result.addresstype === "building" ||
    result.addresstype === "house" ||
    result.extratags?.building
  ) {
    score += 30;
  }

  if (isRoadLevel(result)) {
    score += 6;
  }

  if (result.place_rank && result.place_rank >= 28) {
    score += 10;
  }

  if (result.importance) {
    score += Math.min(5, Math.round(result.importance * 10));
  }

  return score;
}

function inferSiteType(result: NominatimResult): {
  siteType: SiteType;
  reason: string | null;
} {
  const category = result.category ?? null;
  const addresstype = result.addresstype ?? null;
  const extraTags = result.extratags ?? {};

  if (
    category === "building" ||
    addresstype === "building" ||
    addresstype === "house" ||
    typeof extraTags.building === "string"
  ) {
    return {
      siteType: "building",
      reason: "Matched feature is tagged as a building in OpenStreetMap.",
    };
  }

  if (
    category === "landuse" ||
    category === "natural" ||
    category === "leisure" ||
    addresstype === "landuse" ||
    addresstype === "farm" ||
    typeof extraTags.landuse === "string"
  ) {
    return {
      siteType: "plot_of_land",
      reason: "Matched feature is tagged as land use or open land in OpenStreetMap.",
    };
  }

  return {
    siteType: "unknown",
    reason: null,
  };
}

function inferPrecision(result: NominatimResult): LocationPrecision {
  if (
    result.category === "building" ||
    result.addresstype === "building" ||
    result.addresstype === "house" ||
    result.place_rank === 30
  ) {
    return "building";
  }

  if (isRoadLevel(result)) {
    return "street";
  }

  if (result.place_rank && result.place_rank >= 16) {
    return "area";
  }

  return "unknown";
}

function toInputRecord(row: WorkbookRow): InputRecord {
  const item = Number(row.ITEM);
  if (!Number.isFinite(item)) {
    throw new Error(`Invalid ITEM value: ${String(row.ITEM)}`);
  }

  return {
    item,
    utilizedBy: normalizeWhitespace(String(row.UTILIZADO_ ?? "")),
    street: normalizeWhitespace(String(row.LOGRADOURO ?? "")),
    number: normalizeWhitespace(String(row.NUMERO ?? "")),
    neighborhood: normalizeWhitespace(String(row.BAIRRO ?? "")),
  };
}

function selectRows(records: InputRecord[], options: CliOptions): InputRecord[] {
  const startIndex = Math.max(0, options.startAt - 1);
  const sliced = records.slice(startIndex);
  if (options.limit === null) {
    return sliced;
  }

  return sliced.slice(0, options.limit);
}

async function geocodeRecord(
  record: InputRecord,
  cache: GeocodeCache,
  options: CliOptions,
): Promise<OutputRecord> {
  const candidateQueries = buildCandidateQueries(record);
  const attempts: string[] = [];
  let bestMatch:
    | {
        candidate: CandidateQuery;
        result: NominatimResult;
        score: number;
      }
    | null = null;

  for (const candidate of candidateQueries) {
    attempts.push(candidate.query);
    const results = await fetchNominatim(
      candidate.query,
      cache,
      options.cachePath,
      options.delayMs,
    );

    if (results.length === 0) {
      continue;
    }

    for (const result of results) {
      const score = scoreResult(result, candidate, record);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { candidate, result, score };
      }
    }

    if (
      bestMatch &&
      (bestMatch.score >= 90 ||
        inferPrecision(bestMatch.result) === "building" ||
        (inferPrecision(bestMatch.result) === "street" &&
          normalizeMatchText(bestMatch.result.display_name).includes(
            normalizeMatchText(record.neighborhood),
          )))
    ) {
      break;
    }
  }

  const formattedAddress = buildAddressText(record);

  if (!bestMatch) {
    return {
      item: record.item,
      utilizedBy: record.utilizedBy,
      address: {
        street: expandStreetPrefix(record.street),
        number: record.number,
        neighborhood: record.neighborhood,
        city: "Porto Alegre",
        state: "Rio Grande do Sul",
        country: "Brazil",
        formatted: formattedAddress,
      },
      location: null,
      siteType: "unknown",
      siteTypeReason: null,
      match: {
        status: "not_found",
        attempts,
      },
    };
  }

  const { siteType, reason } = inferSiteType(bestMatch.result);

  return {
    item: record.item,
    utilizedBy: record.utilizedBy,
    address: {
      street: expandStreetPrefix(record.street),
      number: record.number,
      neighborhood: record.neighborhood,
      city: "Porto Alegre",
      state: "Rio Grande do Sul",
      country: "Brazil",
      formatted: formattedAddress,
    },
    location: {
      latitude: Number(bestMatch.result.lat),
      longitude: Number(bestMatch.result.lon),
      precision: inferPrecision(bestMatch.result),
      source: NOMINATIM_SOURCE,
    },
    siteType,
    siteTypeReason: reason,
    match: {
      status: "matched",
      queryUsed: bestMatch.candidate.query,
      matchedDisplayName: bestMatch.result.display_name,
      category: bestMatch.result.category ?? null,
      type: bestMatch.result.type ?? null,
      addresstype: bestMatch.result.addresstype ?? null,
      osmType: bestMatch.result.osm_type ?? null,
      osmId: bestMatch.result.osm_id ?? null,
      importance: bestMatch.result.importance ?? null,
      placeRank: bestMatch.result.place_rank ?? null,
      score: bestMatch.score,
    },
  };
}

function buildSummary(
  records: OutputRecord[],
  options: CliOptions,
  inputPath: string,
  outputPath: string,
): ScriptOutput {
  const matchedRows = records.filter((record) => record.location !== null).length;
  const buildingRows = records.filter(
    (record) => record.siteType === "building",
  ).length;
  const plotOfLandRows = records.filter(
    (record) => record.siteType === "plot_of_land",
  ).length;
  const unknownSiteTypeRows = records.filter(
    (record) => record.siteType === "unknown",
  ).length;

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      inputPath,
      outputPath,
      cachePath: options.cachePath,
      geocoder: NOMINATIM_SOURCE,
      delayMs: options.delayMs,
      totalRows: records.length,
      matchedRows,
      unmatchedRows: records.length - matchedRows,
      buildingRows,
      plotOfLandRows,
      unknownSiteTypeRows,
    },
    records,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.inputPath);
  const outputPath = path.resolve(process.cwd(), options.outputPath);
  const cachePath = path.resolve(process.cwd(), options.cachePath);
  const cache = await readJsonFile<GeocodeCache>(cachePath, {});

  const workbook = XLSX.readFile(inputPath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Workbook has no sheets");
  }

  const rawRows = XLSX.utils.sheet_to_json<WorkbookRow>(
    workbook.Sheets[firstSheetName],
    {
      defval: "",
      range: 1,
    },
  );
  const records = rawRows.map(toInputRecord);
  const selectedRecords = selectRows(records, options);
  const outputRecords: OutputRecord[] = [];

  console.log(
    `Processing ${selectedRecords.length} rows from ${path.relative(process.cwd(), inputPath)}`,
  );

  for (let index = 0; index < selectedRecords.length; index += 1) {
    const record = selectedRecords[index];
    if (!record) {
      continue;
    }

    const outputRecord = await geocodeRecord(record, cache, options);
    outputRecords.push(outputRecord);

    if ((index + 1) % 25 === 0 || index + 1 === selectedRecords.length) {
      const matchedRows = outputRecords.filter(
        (candidate) => candidate.location !== null,
      ).length;
      console.log(
        `Processed ${index + 1}/${selectedRecords.length} rows (${matchedRows} with coordinates)`,
      );
    }
  }

  const output = buildSummary(outputRecords, options, inputPath, outputPath);
  await writeJsonFile(outputPath, output);

  console.log(`Wrote ${output.records.length} records to ${outputPath}`);
  console.log(
    `Matched ${output.metadata.matchedRows} rows; ${output.metadata.unmatchedRows} rows need manual review.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

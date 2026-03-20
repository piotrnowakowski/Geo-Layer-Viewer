import fs from "fs/promises";
import path from "path";
import * as turf from "@turf/turf";
import { loadDotEnvFile } from "../shared/loadDotEnv";
import {
  estimateBrazilSolarCarbonOffsetKgPerYear,
  getBrazilSolarCarbonModelMetadata,
} from "../shared/solarCarbon";
import {
  estimateSolarInvestment,
  getSolarInvestmentModelMetadata,
} from "./lib/solarInvestmentModel";

const DEFAULT_INPUT_FILE = "data/building_type/obm_porto_alegre_buildings_commercial.geojson";
const DEFAULT_OUTPUT_FILE =
  "client/public/sample-data/porto-alegre-google-solar-commercial-buildings.json";
const DEFAULT_NEIGHBOURHOODS_FILE = "data/iptu/poa_iptu_neighbourhoods.geojson";
const DEFAULT_CACHE_FILE = "data/building_type/.cache/porto-alegre-google-solar-commercial-cache.json";
const API_ENDPOINT = "https://solar.googleapis.com/v1/buildingInsights:findClosest";
const REQUEST_DELAY_MS = 150;
const DEFAULT_CONCURRENCY = 4;
const CACHE_FLUSH_INTERVAL = 10;
const PARTIAL_SAVE_INTERVAL = 25;
const PARTIAL_SAVE_MIN_MS = 15_000;
const MAX_RETRIES = 4;

interface GoogleMoney {
  currencyCode?: string;
  units?: string;
  nanos?: number;
}

interface GoogleFinancialAnalysis {
  monthlyBill?: GoogleMoney;
  defaultBill?: boolean;
  averageKwhPerMonth?: number;
  financialDetails?: {
    initialAcKwhPerYear?: number;
    solarPercentage?: number;
    percentageExportedToGrid?: number;
    netMeteringAllowed?: boolean;
  };
  cashPurchaseSavings?: {
    paybackYears?: number;
    savings?: {
      savingsLifetime?: GoogleMoney;
    };
  };
  panelConfigIndex?: number;
}

interface GoogleSolarPanelConfig {
  panelsCount?: number;
  yearlyEnergyDcKwh?: number;
}

interface GoogleBuildingInsightsResponse {
  name?: string;
  center?: {
    latitude?: number;
    longitude?: number;
  };
  imageryDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  imageryProcessedDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  postalCode?: string;
  administrativeArea?: string;
  statisticalArea?: string;
  regionCode?: string;
  imageryQuality?: string;
  solarPotential?: {
    maxSunshineHoursPerYear?: number;
    maxArrayPanelsCount?: number;
    maxArrayAreaMeters2?: number;
    carbonOffsetFactorKgPerMwh?: number;
    panelCapacityWatts?: number;
    panelHeightMeters?: number;
    panelWidthMeters?: number;
    panelLifetimeYears?: number;
    wholeRoofStats?: {
      sunshineQuantiles?: number[];
    };
    solarPanelConfigs?: GoogleSolarPanelConfig[];
    financialAnalyses?: GoogleFinancialAnalysis[];
  };
}

interface NormalizedMoney {
  currencyCode: string;
  amount: number;
}

interface PointGeometry {
  type?: string;
  coordinates?: unknown;
}

interface InputFeature {
  type?: string;
  geometry?: PointGeometry;
  properties?: Record<string, unknown>;
}

interface InputFeatureCollection {
  type?: string;
  features?: InputFeature[];
}

interface SelectedCommercialRecord {
  commercialBuildingId: number;
  sourceProperties: Record<string, unknown>;
  sourceLat: number;
  sourceLng: number;
  neighbourhoodName: string | null;
  neighbourhoodNumber: string | null;
}

interface NeighbourhoodBoundary {
  neighbourhoodName: string;
  neighbourhoodNumber: string | null;
  bbox: [number, number, number, number];
  feature: any;
}

interface ImportOptions {
  inputPath: string;
  outputPath: string;
  neighbourhoodsPath: string;
  cachePath: string;
  limit: number | null;
  offset: number;
  seedOnly: boolean;
  concurrency: number;
  delayMs: number;
  partialSaveEvery: number;
  partialSaveMinMs: number;
  includeRawGoogleBuildingInsights: boolean;
  neighbourhoodFilters: string[];
  listNeighbourhoods: boolean;
}

interface SolarResponseCacheEntry {
  latitude: number;
  longitude: number;
  cachedAt: string;
  response: GoogleBuildingInsightsResponse;
}

interface SolarResponseCacheFile {
  source: string;
  updatedAt: string;
  entryCount: number;
  entries: Record<string, SolarResponseCacheEntry>;
}

interface UnmatchedRow {
  commercialBuildingId: number;
  sourceLat: number;
  sourceLng: number;
  neighbourhoodName: string | null;
  neighbourhoodNumber: string | null;
  sourceBuildingType: string | null;
  sourceOccupancyCode: string | null;
  errorCode: number | null;
  errorStatus: string | null;
  errorMessage: string;
}

interface CommercialSolarFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: number[];
  };
  properties: Record<string, any>;
}

class HttpError extends Error {
  status: number;
  payload: any;

  constructor(status: number, payload: any) {
    super(
      payload?.error?.message ||
        payload?.message ||
        `Solar API request failed with status ${status}`
    );
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

function parseArgs(argv: string[]): ImportOptions {
  let inputPath = DEFAULT_INPUT_FILE;
  let outputPath = DEFAULT_OUTPUT_FILE;
  let neighbourhoodsPath = DEFAULT_NEIGHBOURHOODS_FILE;
  let cachePath = DEFAULT_CACHE_FILE;
  let limit: number | null = null;
  let offset = 0;
  let seedOnly = false;
  let concurrency = DEFAULT_CONCURRENCY;
  let delayMs = REQUEST_DELAY_MS;
  let partialSaveEvery = PARTIAL_SAVE_INTERVAL;
  let partialSaveMinMs = PARTIAL_SAVE_MIN_MS;
  let includeRawGoogleBuildingInsights = false;
  const neighbourhoodFilters: string[] = [];
  let listNeighbourhoods = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      inputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if ((arg === "--neighbourhood-data" || arg === "--neighborhood-data") && argv[i + 1]) {
      neighbourhoodsPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--cache" && argv[i + 1]) {
      cachePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (
      arg === "--include-raw-google-building-insights" ||
      arg === "--include-raw-google-response"
    ) {
      includeRawGoogleBuildingInsights = true;
      continue;
    }
    if (arg === "--limit" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--offset" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        offset = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--seed-only") {
      seedOnly = true;
      continue;
    }
    if (arg === "--concurrency" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed >= 1) {
        concurrency = Math.max(1, Math.floor(parsed));
      }
      i += 1;
      continue;
    }
    if (arg === "--delay-ms" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        delayMs = Math.max(0, Math.floor(parsed));
      }
      i += 1;
      continue;
    }
    if (arg === "--partial-save-every" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        partialSaveEvery = Math.max(0, Math.floor(parsed));
      }
      i += 1;
      continue;
    }
    if (arg === "--partial-save-min-ms" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        partialSaveMinMs = Math.max(0, Math.floor(parsed));
      }
      i += 1;
      continue;
    }
    if (
      (arg === "--neighbourhood" || arg === "--neighborhood" || arg === "--bairro") &&
      argv[i + 1]
    ) {
      neighbourhoodFilters.push(...splitListArg(argv[i + 1]));
      i += 1;
      continue;
    }
    if (arg === "--list-neighbourhoods" || arg === "--list-neighborhoods") {
      listNeighbourhoods = true;
    }
  }

  return {
    inputPath: resolveCliPath(inputPath),
    outputPath: resolveCliPath(outputPath),
    neighbourhoodsPath: resolveCliPath(neighbourhoodsPath),
    cachePath: resolveCliPath(cachePath),
    limit,
    offset,
    seedOnly,
    concurrency,
    delayMs,
    partialSaveEvery,
    partialSaveMinMs,
    includeRawGoogleBuildingInsights,
    neighbourhoodFilters,
    listNeighbourhoods,
  };
}

function splitListArg(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveCliPath(input: string): string {
  const trimmed = input.trim();
  const cwd = process.cwd();
  const repoName = path.win32.basename(cwd).toLowerCase();

  const wslMatch = trimmed.match(/^\/mnt\/([A-Za-z])\/(.*)$/);
  if (wslMatch) {
    const [, drive, rest] = wslMatch;
    const normalizedWsl = path.posix.normalize(trimmed);
    if (process.platform === "win32") {
      const marker = `/${repoName}/`;
      const idx = normalizedWsl.toLowerCase().indexOf(marker);
      if (idx !== -1) {
        return normalizedWsl.slice(idx + marker.length).replace(/\//g, "\\");
      }
      return path.win32.normalize(`${drive.toUpperCase()}:\\${rest.replace(/\//g, "\\")}`);
    }
    return path.posix.normalize(trimmed);
  }

  const winMatch = trimmed.match(/^([A-Za-z]):[\\/](.*)$/);
  if (winMatch) {
    if (process.platform === "win32") {
      const normalizedWin = path.win32.normalize(trimmed);
      const marker = `\\${repoName}\\`;
      const idx = normalizedWin.toLowerCase().indexOf(marker);
      if (idx !== -1) {
        return normalizedWin.slice(idx + marker.length);
      }
      return normalizedWin;
    }
    const [, drive, rest] = winMatch;
    return path.posix.normalize(`/mnt/${drive.toLowerCase()}/${rest.replace(/\\/g, "/")}`);
  }
  if (path.isAbsolute(trimmed)) return trimmed;
  if (process.platform === "win32") return path.win32.normalize(trimmed);
  return path.resolve(process.cwd(), trimmed);
}

function normalizeMoney(money?: GoogleMoney | null): NormalizedMoney | null {
  if (!money) return null;

  const units = Number(money.units ?? 0);
  const nanos = Number(money.nanos ?? 0);
  if (!Number.isFinite(units) || !Number.isFinite(nanos)) return null;

  return {
    currencyCode: money.currencyCode ?? "",
    amount: units + nanos / 1_000_000_000,
  };
}

function toIsoDate(date?: { year?: number; month?: number; day?: number } | null): string | null {
  const year = date?.year;
  const month = date?.month;
  const day = date?.day;
  if (!year || !month || !day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function getStringProperty(
  sourceProperties: Record<string, unknown>,
  key: string
): string | null {
  const value = sourceProperties[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeNeighbourhoodName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function loadNeighbourhoodBoundaries(
  neighbourhoodsPath: string
): Promise<NeighbourhoodBoundary[]> {
  const raw = await fs.readFile(neighbourhoodsPath, "utf8");
  const parsed = JSON.parse(raw) as { features?: any[] };
  const features = Array.isArray(parsed.features) ? parsed.features : [];

  const boundaries = features.flatMap((feature) => {
    const props = feature?.properties ?? {};
    const neighbourhoodName =
      typeof props.neighbourhood_name === "string" ? props.neighbourhood_name.trim() : "";
    const neighbourhoodNumber =
      typeof props.neighbourhood_number === "string" || typeof props.neighbourhood_number === "number"
        ? String(props.neighbourhood_number)
        : null;
    const geometryType = feature?.geometry?.type;

    if (!neighbourhoodName || !["Polygon", "MultiPolygon"].includes(geometryType)) {
      return [];
    }

    return [
      {
        neighbourhoodName,
        neighbourhoodNumber,
        bbox: turf.bbox(feature as any) as [number, number, number, number],
        feature,
      },
    ];
  });

  if (boundaries.length === 0) {
    throw new Error(`No valid neighbourhood polygons found in ${neighbourhoodsPath}`);
  }

  boundaries.sort((a, b) => a.neighbourhoodName.localeCompare(b.neighbourhoodName));
  return boundaries;
}

function resolveNeighbourhoodFilters(
  boundaries: NeighbourhoodBoundary[],
  requestedFilters: string[]
): string[] {
  if (requestedFilters.length === 0) return [];

  const availableByNormalized = new Map(
    boundaries.map((boundary) => [
      normalizeNeighbourhoodName(boundary.neighbourhoodName),
      boundary.neighbourhoodName,
    ])
  );

  const selected = new Set<string>();
  const unknown: string[] = [];

  for (const requested of requestedFilters) {
    const match = availableByNormalized.get(normalizeNeighbourhoodName(requested));
    if (!match) {
      unknown.push(requested);
      continue;
    }
    selected.add(match);
  }

  if (unknown.length > 0) {
    throw new Error(
      `Unknown neighbourhood filter(s): ${unknown.join(", ")}. Use --list-neighbourhoods to inspect valid names.`
    );
  }

  return Array.from(selected);
}

function listAvailableNeighbourhoods(
  boundaries: NeighbourhoodBoundary[]
): Array<{ neighbourhoodName: string; neighbourhoodNumber: string | null }> {
  const byName = new Map<string, string | null>();

  for (const boundary of boundaries) {
    if (!byName.has(boundary.neighbourhoodName)) {
      byName.set(boundary.neighbourhoodName, boundary.neighbourhoodNumber);
    }
  }

  return Array.from(byName.entries())
    .map(([neighbourhoodName, neighbourhoodNumber]) => ({
      neighbourhoodName,
      neighbourhoodNumber,
    }))
    .sort((a, b) => a.neighbourhoodName.localeCompare(b.neighbourhoodName));
}

function findNeighbourhoodForPoint(
  longitude: number,
  latitude: number,
  boundaries: NeighbourhoodBoundary[]
): Pick<SelectedCommercialRecord, "neighbourhoodName" | "neighbourhoodNumber"> {
  const testPoint = turf.point([longitude, latitude]);

  for (const boundary of boundaries) {
    const [minLng, minLat, maxLng, maxLat] = boundary.bbox;
    if (longitude < minLng || longitude > maxLng || latitude < minLat || latitude > maxLat) {
      continue;
    }

    if (turf.booleanPointInPolygon(testPoint, boundary.feature as any)) {
      return {
        neighbourhoodName: boundary.neighbourhoodName,
        neighbourhoodNumber: boundary.neighbourhoodNumber,
      };
    }
  }

  return {
    neighbourhoodName: null,
    neighbourhoodNumber: null,
  };
}

function buildSelectedRecords(
  parsed: InputFeatureCollection,
  boundaries: NeighbourhoodBoundary[]
): SelectedCommercialRecord[] {
  const features = Array.isArray(parsed.features) ? parsed.features : [];
  const selected: SelectedCommercialRecord[] = [];

  for (let index = 0; index < features.length; index += 1) {
    const feature = features[index];
    const geometry = feature.geometry;
    const coordinates = geometry?.coordinates;

    if (
      geometry?.type !== "Point" ||
      !Array.isArray(coordinates) ||
      coordinates.length < 2 ||
      typeof coordinates[0] !== "number" ||
      !Number.isFinite(coordinates[0]) ||
      typeof coordinates[1] !== "number" ||
      !Number.isFinite(coordinates[1])
    ) {
      continue;
    }

    const neighbourhoodMatch = findNeighbourhoodForPoint(coordinates[0], coordinates[1], boundaries);

    selected.push({
      commercialBuildingId: index + 1,
      sourceProperties: feature.properties ?? {},
      sourceLng: coordinates[0],
      sourceLat: coordinates[1],
      neighbourhoodName: neighbourhoodMatch.neighbourhoodName,
      neighbourhoodNumber: neighbourhoodMatch.neighbourhoodNumber,
    });
  }

  return selected;
}

function filterRecordsByNeighbourhood(
  records: SelectedCommercialRecord[],
  selectedNeighbourhoods: string[]
): SelectedCommercialRecord[] {
  if (selectedNeighbourhoods.length === 0) return records;

  const selectedSet = new Set(selectedNeighbourhoods);
  return records.filter(
    (record) => record.neighbourhoodName && selectedSet.has(record.neighbourhoodName)
  );
}

function countRecordsByNeighbourhood(
  records: Array<Pick<SelectedCommercialRecord, "neighbourhoodName">>
): Record<string, number> {
  const counts = new Map<string, number>();

  for (const record of records) {
    const key = record.neighbourhoodName ?? "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Object.fromEntries(
    Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  );
}

function createCoordinateCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function countUniqueCoordinateKeys(records: SelectedCommercialRecord[]): number {
  return new Set(
    records.map((record) => createCoordinateCacheKey(record.sourceLat, record.sourceLng))
  ).size;
}

async function loadResponseCache(
  cachePath: string
): Promise<Record<string, SolarResponseCacheEntry>> {
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SolarResponseCacheFile>;
    return parsed.entries ?? {};
  } catch {
    return {};
  }
}

async function persistResponseCache(
  cachePath: string,
  entries: Record<string, SolarResponseCacheEntry>
): Promise<void> {
  const payload: SolarResponseCacheFile = {
    source: "google-solar-building-insights-cache",
    updatedAt: new Date().toISOString(),
    entryCount: Object.keys(entries).length,
    entries,
  };
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function writeJsonFileAtomic(
  filePath: string,
  payload: unknown,
  pretty = true
): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  const serialized = pretty
    ? `${JSON.stringify(payload, null, 2)}\n`
    : `${JSON.stringify(payload)}\n`;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, serialized, "utf8");

  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as any).code) : "";
    if (code === "EEXIST" || code === "EPERM") {
      await fs.rm(filePath, { force: true });
      await fs.rename(tempPath, filePath);
      return;
    }
    throw error;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}

async function fetchBuildingInsights(
  apiKey: string,
  latitude: number,
  longitude: number
): Promise<GoogleBuildingInsightsResponse> {
  const params = new URLSearchParams({
    "location.latitude": latitude.toFixed(6),
    "location.longitude": longitude.toFixed(6),
    requiredQuality: "BASE",
    key: apiKey,
  });

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);
    const payload = await response.json().catch(() => null);

    if (response.ok) {
      return payload as GoogleBuildingInsightsResponse;
    }

    if (!isRetryableStatus(response.status) || attempt === MAX_RETRIES) {
      throw new HttpError(response.status, payload);
    }

    await sleep(REQUEST_DELAY_MS * Math.pow(2, attempt + 1));
    attempt += 1;
  }

  throw new Error("Unreachable retry state");
}

function selectFinancialAnalysis(
  analyses: GoogleFinancialAnalysis[] | undefined
): GoogleFinancialAnalysis | null {
  if (!analyses || analyses.length === 0) return null;
  return analyses.find((analysis) => analysis.defaultBill) ?? analyses[0] ?? null;
}

function selectMaxPanelConfig(
  configs: GoogleSolarPanelConfig[] | undefined
): GoogleSolarPanelConfig | null {
  if (!configs || configs.length === 0) return null;

  return configs.reduce<GoogleSolarPanelConfig | null>((best, current) => {
    if (!best) return current;
    const bestPanels = best.panelsCount ?? -1;
    const currentPanels = current.panelsCount ?? -1;
    if (currentPanels !== bestPanels) {
      return currentPanels > bestPanels ? current : best;
    }

    const bestEnergy = best.yearlyEnergyDcKwh ?? -1;
    const currentEnergy = current.yearlyEnergyDcKwh ?? -1;
    return currentEnergy > bestEnergy ? current : best;
  }, null);
}

function buildEstimatedInvestmentProperties(
  panelCount: number | null | undefined,
  panelCapacityWatts: number | null | undefined
) {
  const estimate = estimateSolarInvestment(panelCount, panelCapacityWatts);

  return {
    estimatedInstalledCostPerPanel: estimate?.estimatedInstalledCostPerPanel ?? null,
    estimatedInvestmentCost: estimate?.estimatedInvestmentCost ?? null,
  };
}

function buildFeature(
  record: SelectedCommercialRecord,
  response: GoogleBuildingInsightsResponse,
  includeRawGoogleBuildingInsights: boolean
): CommercialSolarFeature {
  const matchedCenterLat = response.center?.latitude ?? record.sourceLat;
  const matchedCenterLng = response.center?.longitude ?? record.sourceLng;
  const analysis = selectFinancialAnalysis(response.solarPotential?.financialAnalyses);
  const maxPanelConfig = selectMaxPanelConfig(response.solarPotential?.solarPanelConfigs);
  const financialDetails = analysis?.financialDetails;
  const initialAcKwhPerYear = financialDetails?.initialAcKwhPerYear ?? null;
  const percentageExportedToGrid = financialDetails?.percentageExportedToGrid ?? null;
  const carbonOffsetFactorKgPerMwh = response.solarPotential?.carbonOffsetFactorKgPerMwh ?? null;
  const maxArrayPanelsCount =
    response.solarPotential?.maxArrayPanelsCount ?? maxPanelConfig?.panelsCount ?? null;
  const panelCapacityWatts = response.solarPotential?.panelCapacityWatts ?? null;
  const maxYearlyEnergyDcKwh = maxPanelConfig?.yearlyEnergyDcKwh ?? null;
  const estimatedInvestment = buildEstimatedInvestmentProperties(
    maxArrayPanelsCount,
    panelCapacityWatts
  );
  const estimatedCarbonOffsetKgPerYear =
    estimateBrazilSolarCarbonOffsetKgPerYear(maxYearlyEnergyDcKwh);
  const carbonOffsetKgPerYear =
    initialAcKwhPerYear !== null && carbonOffsetFactorKgPerMwh !== null
      ? (initialAcKwhPerYear / 1000) * carbonOffsetFactorKgPerMwh
      : null;
  const annualExportedToGridKwh =
    initialAcKwhPerYear !== null && percentageExportedToGrid !== null
      ? initialAcKwhPerYear * (percentageExportedToGrid / 100)
      : null;

  return {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [matchedCenterLng, matchedCenterLat],
    },
    properties: {
      ...record.sourceProperties,
      commercialBuildingId: record.commercialBuildingId,
      neighbourhoodName: record.neighbourhoodName,
      neighbourhoodNumber: record.neighbourhoodNumber,
      sourceLat: record.sourceLat,
      sourceLng: record.sourceLng,
      googleBuildingName: response.name ?? null,
      matchedCenterLat,
      matchedCenterLng,
      matchDistanceMeters: haversineMeters(
        record.sourceLat,
        record.sourceLng,
        matchedCenterLat,
        matchedCenterLng
      ),
      imageryQuality: response.imageryQuality ?? null,
      imageryDate: toIsoDate(response.imageryDate),
      imageryProcessedDate: toIsoDate(response.imageryProcessedDate),
      postalCode: response.postalCode ?? null,
      administrativeArea: response.administrativeArea ?? null,
      statisticalArea: response.statisticalArea ?? null,
      regionCode: response.regionCode ?? null,
      maxSunshineHoursPerYear: response.solarPotential?.maxSunshineHoursPerYear ?? null,
      maxArrayPanelsCount,
      panelCapacityWatts,
      maxYearlyEnergyDcKwh,
      sunshineQuantiles: response.solarPotential?.wholeRoofStats?.sunshineQuantiles ?? [],
      carbonOffsetFactorKgPerMwh,
      ...estimatedInvestment,
      importStatus: "enriched",
      importMessage: null,
      monthlyBill: normalizeMoney(analysis?.monthlyBill),
      averageKwhPerMonth: analysis?.averageKwhPerMonth ?? null,
      initialAcKwhPerYear,
      solarPercentage: financialDetails?.solarPercentage ?? null,
      percentageExportedToGrid,
      netMeteringAllowed: financialDetails?.netMeteringAllowed ?? null,
      paybackYears: analysis?.cashPurchaseSavings?.paybackYears ?? null,
      lifetimeSavings: normalizeMoney(analysis?.cashPurchaseSavings?.savings?.savingsLifetime),
      carbonOffsetKgPerYear,
      estimatedCarbonOffsetKgPerYear,
      annualExportedToGridKwh,
      ...(includeRawGoogleBuildingInsights ? { googleBuildingInsights: response } : {}),
    },
  };
}

function buildSeedFeature(
  record: SelectedCommercialRecord,
  includeRawGoogleBuildingInsights: boolean
): CommercialSolarFeature {
  const estimatedInvestment = buildEstimatedInvestmentProperties(null, null);

  return {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [record.sourceLng, record.sourceLat],
    },
    properties: {
      ...record.sourceProperties,
      commercialBuildingId: record.commercialBuildingId,
      neighbourhoodName: record.neighbourhoodName,
      neighbourhoodNumber: record.neighbourhoodNumber,
      sourceLat: record.sourceLat,
      sourceLng: record.sourceLng,
      googleBuildingName: null,
      matchedCenterLat: record.sourceLat,
      matchedCenterLng: record.sourceLng,
      matchDistanceMeters: 0,
      imageryQuality: null,
      imageryDate: null,
      imageryProcessedDate: null,
      postalCode: null,
      administrativeArea: null,
      statisticalArea: null,
      regionCode: null,
      maxSunshineHoursPerYear: null,
      maxArrayPanelsCount: null,
      panelCapacityWatts: null,
      maxYearlyEnergyDcKwh: null,
      sunshineQuantiles: [],
      carbonOffsetFactorKgPerMwh: null,
      ...estimatedInvestment,
      importStatus: "seed_only",
      importMessage: "Awaiting Google Solar API enrichment",
      monthlyBill: null,
      averageKwhPerMonth: null,
      initialAcKwhPerYear: null,
      solarPercentage: null,
      percentageExportedToGrid: null,
      netMeteringAllowed: null,
      paybackYears: null,
      lifetimeSavings: null,
      carbonOffsetKgPerYear: null,
      estimatedCarbonOffsetKgPerYear: null,
      annualExportedToGridKwh: null,
      ...(includeRawGoogleBuildingInsights ? { googleBuildingInsights: null } : {}),
    },
  };
}

async function main() {
  await loadDotEnvFile();
  const options = parseArgs(process.argv.slice(2));
  const neighbourhoodBoundaries = await loadNeighbourhoodBoundaries(options.neighbourhoodsPath);
  const availableNeighbourhoods = listAvailableNeighbourhoods(neighbourhoodBoundaries);
  const selectedNeighbourhoods = resolveNeighbourhoodFilters(
    neighbourhoodBoundaries,
    options.neighbourhoodFilters
  );

  if (options.listNeighbourhoods) {
    for (const neighbourhood of availableNeighbourhoods) {
      const suffix = neighbourhood.neighbourhoodNumber
        ? ` (${neighbourhood.neighbourhoodNumber})`
        : "";
      console.log(`${neighbourhood.neighbourhoodName}${suffix}`);
    }
    return;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!options.seedOnly && !apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required unless --seed-only is used");
  }

  const raw = await fs.readFile(options.inputPath, "utf8");
  const parsed = JSON.parse(raw) as InputFeatureCollection;
  const allRecords = buildSelectedRecords(parsed, neighbourhoodBoundaries);
  const filteredRecords = filterRecordsByNeighbourhood(allRecords, selectedNeighbourhoods);
  const selectedRecords =
    options.limit === null
      ? filteredRecords.slice(options.offset)
      : filteredRecords.slice(options.offset, options.offset + options.limit);

  const cacheEntries: Record<string, SolarResponseCacheEntry> = options.seedOnly
    ? {}
    : await loadResponseCache(options.cachePath);
  const featureResults = new Array<CommercialSolarFeature | null>(selectedRecords.length).fill(null);
  const unmatchedResults = new Array<UnmatchedRow | null>(selectedRecords.length).fill(null);
  const inFlightByKey = new Map<string, Promise<GoogleBuildingInsightsResponse>>();
  let cacheHitCount = 0;
  let sharedRequestCount = 0;
  let apiRequestCount = 0;
  let dirtyCacheWrites = 0;
  let cachePersistenceDisabled = false;
  let completedRecordCount = 0;
  let lastPartialSaveCount = 0;
  let lastPartialSaveAt = 0;
  let cachePersistChain = Promise.resolve();
  let outputPersistChain = Promise.resolve();

  const buildOutputPayload = (outputStatus: "partial" | "complete") => {
    const features = featureResults.filter(
      (feature): feature is CommercialSolarFeature => feature !== null
    );
    const unmatched = unmatchedResults.filter((row): row is UnmatchedRow => row !== null);

    return {
      source: options.seedOnly
        ? "google-solar-building-insights-seed"
        : "google-solar-building-insights",
      importedAt: new Date().toISOString(),
      outputStatus,
      inputFile: options.inputPath,
      neighbourhoodsFile: options.neighbourhoodsPath,
      cacheFile: options.cachePath,
      mode: options.seedOnly ? "seed_only" : "enriched",
      estimatedInvestmentCostModel: getSolarInvestmentModelMetadata(),
      estimatedCarbonOffsetModel: getBrazilSolarCarbonModelMetadata(),
      totalInputFeatures: allRecords.length,
      availableNeighbourhoodCount: availableNeighbourhoods.length,
      selectedNeighbourhoods,
      totalRecordsAfterNeighbourhoodFilter: filteredRecords.length,
      selectedUniqueCoordinateCount: countUniqueCoordinateKeys(selectedRecords),
      selectedOffset: options.offset,
      selectedLimit: options.limit,
      concurrency: options.seedOnly ? 1 : options.concurrency,
      delayMs: options.delayMs,
      partialSaveEvery: options.partialSaveEvery,
      partialSaveMinMs: options.partialSaveMinMs,
      includeRawGoogleBuildingInsights: options.includeRawGoogleBuildingInsights,
      cacheHitCount,
      sharedRequestCount,
      apiRequestCount,
      cachePersistenceDisabled,
      processedRecordCount: completedRecordCount,
      pendingRecordCount: Math.max(0, selectedRecords.length - completedRecordCount),
      featureCount: features.length,
      unmatchedCount: unmatched.length,
      selectedRecordCountByNeighbourhood: countRecordsByNeighbourhood(selectedRecords),
      featureCountByNeighbourhood: countRecordsByNeighbourhood(
        features.map((feature) => ({
          neighbourhoodName: feature.properties.neighbourhoodName ?? null,
        }))
      ),
      geoJson: {
        type: "FeatureCollection" as const,
        features,
      },
      unmatched,
    };
  };

  const flushCacheIfNeeded = async (force = false) => {
    if (options.seedOnly || cachePersistenceDisabled) return;
    if (!force && dirtyCacheWrites < CACHE_FLUSH_INTERVAL) return;
    if (dirtyCacheWrites === 0) return;

    dirtyCacheWrites = 0;
    cachePersistChain = cachePersistChain
      .catch(() => undefined)
      .then(async () => {
        try {
          await persistResponseCache(options.cachePath, cacheEntries);
        } catch (error) {
          cachePersistenceDisabled = true;
          console.warn(
            `[solar-import] Cache checkpoint disabled after write failure: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      });
    await cachePersistChain;
  };

  const flushPartialOutputIfNeeded = async () => {
    if (options.partialSaveEvery <= 0 && options.partialSaveMinMs <= 0) return;

    const now = Date.now();
    const completedSinceLastSave = completedRecordCount - lastPartialSaveCount;
    const reachedCountThreshold =
      options.partialSaveEvery > 0 && completedSinceLastSave >= options.partialSaveEvery;
    const reachedTimeThreshold =
      options.partialSaveMinMs > 0 &&
      completedSinceLastSave > 0 &&
      now - lastPartialSaveAt >= options.partialSaveMinMs;

    if (!reachedCountThreshold && !reachedTimeThreshold) return;

    outputPersistChain = outputPersistChain
      .catch(() => undefined)
      .then(async () => {
        const partialOutput = buildOutputPayload("partial");
        if (partialOutput.processedRecordCount <= lastPartialSaveCount) return;

        await writeJsonFileAtomic(options.outputPath, partialOutput, false);
        lastPartialSaveCount = partialOutput.processedRecordCount;
        lastPartialSaveAt = Date.now();

        console.log(
          `[solar-import] Checkpoint ${partialOutput.processedRecordCount}/${selectedRecords.length} -> ${options.outputPath}`
        );
      });

    await outputPersistChain;
  };

  console.log(
    `[solar-import] ${options.seedOnly ? "Preparing seed overlay" : "Importing Solar API data"} for ${selectedRecords.length} commercial buildings from ${options.inputPath}${
      selectedNeighbourhoods.length > 0
        ? ` in ${selectedNeighbourhoods.join(", ")}`
        : ""
    }${options.seedOnly ? "" : ` with concurrency=${options.concurrency}, delay=${options.delayMs}ms`}`
  );

  await runWithConcurrency(selectedRecords, options.seedOnly ? 1 : options.concurrency, async (record, index) => {
    let shouldDelay = false;

    try {
      if (options.seedOnly) {
        featureResults[index] = buildSeedFeature(
          record,
          options.includeRawGoogleBuildingInsights
        );
        console.log(
          `[solar-import] ${index + 1}/${selectedRecords.length} SEEDED commercialBuildingId=${record.commercialBuildingId}`
        );
        return;
      }

      const cacheKey = createCoordinateCacheKey(record.sourceLat, record.sourceLng);
      const cachedEntry = cacheEntries[cacheKey];

      if (cachedEntry) {
        cacheHitCount += 1;
        featureResults[index] = buildFeature(
          record,
          cachedEntry.response,
          options.includeRawGoogleBuildingInsights
        );
        console.log(
          `[solar-import] ${index + 1}/${selectedRecords.length} CACHED commercialBuildingId=${record.commercialBuildingId}`
        );
        return;
      }

      const existingPromise = inFlightByKey.get(cacheKey);
      if (existingPromise) {
        sharedRequestCount += 1;
        const sharedResponse = await existingPromise;
        featureResults[index] = buildFeature(
          record,
          sharedResponse,
          options.includeRawGoogleBuildingInsights
        );
        console.log(
          `[solar-import] ${index + 1}/${selectedRecords.length} SHARED commercialBuildingId=${record.commercialBuildingId}`
        );
        return;
      }

      const requestPromise = fetchBuildingInsights(
        apiKey as string,
        record.sourceLat,
        record.sourceLng
      );
      shouldDelay = true;
      inFlightByKey.set(cacheKey, requestPromise);

      try {
        const response = await requestPromise;
        apiRequestCount += 1;
        cacheEntries[cacheKey] = {
          latitude: record.sourceLat,
          longitude: record.sourceLng,
          cachedAt: new Date().toISOString(),
          response,
        };
        dirtyCacheWrites += 1;
        featureResults[index] = buildFeature(
          record,
          response,
          options.includeRawGoogleBuildingInsights
        );
        console.log(
          `[solar-import] ${index + 1}/${selectedRecords.length} OK commercialBuildingId=${record.commercialBuildingId}`
        );
        await flushCacheIfNeeded();
      } finally {
        inFlightByKey.delete(cacheKey);
      }
    } catch (error) {
      const httpError = error instanceof HttpError ? error : null;
      unmatchedResults[index] = {
        commercialBuildingId: record.commercialBuildingId,
        sourceLat: record.sourceLat,
        sourceLng: record.sourceLng,
        neighbourhoodName: record.neighbourhoodName,
        neighbourhoodNumber: record.neighbourhoodNumber,
        sourceBuildingType: getStringProperty(record.sourceProperties, "building_type"),
        sourceOccupancyCode: getStringProperty(record.sourceProperties, "occupancy_code"),
        errorCode: httpError?.status ?? null,
        errorStatus: httpError?.payload?.error?.status ?? null,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
      console.warn(
        `[solar-import] ${index + 1}/${selectedRecords.length} FAILED commercialBuildingId=${record.commercialBuildingId}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      if (shouldDelay && options.delayMs > 0) {
        await sleep(options.delayMs);
      }
      completedRecordCount += 1;
      await flushPartialOutputIfNeeded();
    }
  });

  await flushCacheIfNeeded(true);
  await outputPersistChain.catch(() => undefined);

  const output = buildOutputPayload("complete");
  await writeJsonFileAtomic(options.outputPath, output, true);

  console.log(
    `[solar-import] Wrote ${output.featureCount} features and ${output.unmatchedCount} unmatched rows to ${options.outputPath}`
  );
}

main().catch((error) => {
  console.error(`[solar-import] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

import fs from "fs/promises";
import path from "path";
import { loadDotEnvFile } from "../shared/loadDotEnv";

const DEFAULT_INPUT_FILE = "pv_panel_data/Municipal_buildings.geocoded.json";
const DEFAULT_OUTPUT_FILE =
  "client/public/sample-data/porto-alegre-google-solar-municipal-buildings.json";
const API_ENDPOINT = "https://solar.googleapis.com/v1/buildingInsights:findClosest";
const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 4;

interface GeocodedAddress {
  formatted?: string;
}

interface GeocodedLocation {
  latitude?: number;
  longitude?: number;
}

interface GeocodedMatch {
  status?: string;
  matchedAddress?: string;
  postalCode?: string;
}

interface GeocodedRecord {
  item?: number | string;
  utilizedBy?: string;
  address?: GeocodedAddress;
  location?: GeocodedLocation;
  match?: GeocodedMatch;
}

interface GeocodedFile {
  records?: GeocodedRecord[];
}

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

interface ImportOptions {
  inputPath: string;
  outputPath: string;
  limit: number | null;
  offset: number;
  seedOnly: boolean;
}

interface UnmatchedRow {
  municipalBuildingId: number | string | null;
  utilizedBy: string | null;
  sourceLat: number;
  sourceLng: number;
  errorCode: number | null;
  errorStatus: string | null;
  errorMessage: string;
}

interface MunicipalSolarFeature {
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
  let limit: number | null = null;
  let offset = 0;
  let seedOnly = false;

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
    }
  }

  return {
    inputPath: resolveCliPath(inputPath),
    outputPath: resolveCliPath(outputPath),
    limit,
    offset,
    seedOnly,
  };
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

function buildFeature(
  record: GeocodedRecord,
  response: GoogleBuildingInsightsResponse
): MunicipalSolarFeature {
  const sourceLat = record.location!.latitude as number;
  const sourceLng = record.location!.longitude as number;
  const matchedCenterLat = response.center?.latitude ?? sourceLat;
  const matchedCenterLng = response.center?.longitude ?? sourceLng;
  const analysis = selectFinancialAnalysis(response.solarPotential?.financialAnalyses);
  const maxPanelConfig = selectMaxPanelConfig(response.solarPotential?.solarPanelConfigs);
  const financialDetails = analysis?.financialDetails;
  const initialAcKwhPerYear = financialDetails?.initialAcKwhPerYear ?? null;
  const percentageExportedToGrid = financialDetails?.percentageExportedToGrid ?? null;
  const carbonOffsetFactorKgPerMwh = response.solarPotential?.carbonOffsetFactorKgPerMwh ?? null;
  const maxArrayPanelsCount = response.solarPotential?.maxArrayPanelsCount ?? null;
  const panelCapacityWatts = response.solarPotential?.panelCapacityWatts ?? null;
  const maxYearlyEnergyDcKwh = maxPanelConfig?.yearlyEnergyDcKwh ?? null;
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
      municipalBuildingId: record.item ?? null,
      utilizedBy: record.utilizedBy ?? null,
      sourceAddress: record.address?.formatted ?? null,
      sourceLat,
      sourceLng,
      matchedAddress: record.match?.matchedAddress ?? null,
      matchedPostalCode: record.match?.postalCode ?? null,
      googleBuildingName: response.name ?? null,
      matchedCenterLat,
      matchedCenterLng,
      matchDistanceMeters: haversineMeters(sourceLat, sourceLng, matchedCenterLat, matchedCenterLng),
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
      annualExportedToGridKwh,
      googleBuildingInsights: response,
    },
  };
}

function buildSeedFeature(record: GeocodedRecord): MunicipalSolarFeature {
  const sourceLat = record.location!.latitude as number;
  const sourceLng = record.location!.longitude as number;

  return {
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [sourceLng, sourceLat],
    },
    properties: {
      municipalBuildingId: record.item ?? null,
      utilizedBy: record.utilizedBy ?? null,
      sourceAddress: record.address?.formatted ?? null,
      sourceLat,
      sourceLng,
      matchedAddress: record.match?.matchedAddress ?? null,
      matchedPostalCode: record.match?.postalCode ?? null,
      googleBuildingName: null,
      matchedCenterLat: sourceLat,
      matchedCenterLng: sourceLng,
      matchDistanceMeters: 0,
      imageryQuality: null,
      imageryDate: null,
      imageryProcessedDate: null,
      postalCode: record.match?.postalCode ?? null,
      administrativeArea: null,
      statisticalArea: null,
      regionCode: null,
      maxSunshineHoursPerYear: null,
      maxArrayPanelsCount: null,
      panelCapacityWatts: null,
      maxYearlyEnergyDcKwh: null,
      sunshineQuantiles: [],
      carbonOffsetFactorKgPerMwh: null,
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
      annualExportedToGridKwh: null,
      googleBuildingInsights: null,
    },
  };
}

async function main() {
  await loadDotEnvFile();
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!options.seedOnly && !apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is required unless --seed-only is used");
  }

  const raw = await fs.readFile(options.inputPath, "utf8");
  const parsed = JSON.parse(raw) as GeocodedFile;
  const allRecords = Array.isArray(parsed.records) ? parsed.records : [];

  const matchedRecords = allRecords.filter((record) => {
    const lat = record.location?.latitude;
    const lng = record.location?.longitude;
    return (
      record.match?.status === "matched" &&
      typeof lat === "number" &&
      Number.isFinite(lat) &&
      typeof lng === "number" &&
      Number.isFinite(lng)
    );
  });
  const selectedRecords =
    options.limit === null
      ? matchedRecords.slice(options.offset)
      : matchedRecords.slice(options.offset, options.offset + options.limit);

  const features: MunicipalSolarFeature[] = [];
  const unmatched: UnmatchedRow[] = [];

  console.log(
    `[solar-import] ${options.seedOnly ? "Preparing seed overlay" : "Importing Solar API data"} for ${selectedRecords.length} municipal buildings from ${options.inputPath}`
  );

  for (let index = 0; index < selectedRecords.length; index += 1) {
    const record = selectedRecords[index];
    const latitude = record.location!.latitude as number;
    const longitude = record.location!.longitude as number;

    if (options.seedOnly) {
      features.push(buildSeedFeature(record));
      console.log(
        `[solar-import] ${index + 1}/${selectedRecords.length} SEEDED item=${String(record.item ?? "")}`
      );
      continue;
    }

    try {
      const response = await fetchBuildingInsights(apiKey as string, latitude, longitude);
      features.push(buildFeature(record, response));
      console.log(
        `[solar-import] ${index + 1}/${selectedRecords.length} OK item=${String(record.item ?? "")}`
      );
    } catch (error) {
      const httpError = error instanceof HttpError ? error : null;
      unmatched.push({
        municipalBuildingId: record.item ?? null,
        utilizedBy: record.utilizedBy ?? null,
        sourceLat: latitude,
        sourceLng: longitude,
        errorCode: httpError?.status ?? null,
        errorStatus: httpError?.payload?.error?.status ?? null,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      console.warn(
        `[solar-import] ${index + 1}/${selectedRecords.length} FAILED item=${String(record.item ?? "")}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    if (index < selectedRecords.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const output = {
    source: options.seedOnly ? "google-solar-building-insights-seed" : "google-solar-building-insights",
    importedAt: new Date().toISOString(),
    inputFile: options.inputPath,
    mode: options.seedOnly ? "seed_only" : "enriched",
    totalMatchedRecords: matchedRecords.length,
    selectedOffset: options.offset,
    selectedLimit: options.limit,
    featureCount: features.length,
    unmatchedCount: unmatched.length,
    geoJson: {
      type: "FeatureCollection" as const,
      features,
    },
    unmatched,
  };

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await fs.writeFile(options.outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(
    `[solar-import] Wrote ${features.length} features and ${unmatched.length} unmatched rows to ${options.outputPath}`
  );
}

main().catch((error) => {
  console.error(`[solar-import] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

import fs from "fs/promises";
import path from "path";

const DEFAULT_INPUT_FILE =
  "client/public/sample-data/porto-alegre-google-solar-commercial-buildings.json";
const DEFAULT_OUTPUT_FILE =
  "client/public/sample-data/porto-alegre-google-solar-commercial-neighbourhoods.json";
const DEFAULT_NEIGHBOURHOODS_FILE = "data/iptu/poa_iptu_neighbourhoods.geojson";

type Position = number[];
type PolygonCoordinates = Position[][];
type MultiPolygonCoordinates = Position[][][];

interface PolygonGeometry {
  type: "Polygon";
  coordinates: PolygonCoordinates;
}

interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: MultiPolygonCoordinates;
}

type SupportedGeometry = PolygonGeometry | MultiPolygonGeometry;

interface GeoJsonFeature {
  type?: string;
  geometry?: SupportedGeometry | null;
  properties?: Record<string, unknown>;
}

interface GeoJsonFeatureCollection {
  type?: string;
  features?: GeoJsonFeature[];
}

interface AggregateOptions {
  inputPath: string;
  outputPath: string;
  neighbourhoodsPath: string;
  includeEmpty: boolean;
}

interface BoundaryGroup {
  key: string;
  neighbourhoodName: string;
  neighbourhoodNumber: string | null;
  polygons: PolygonCoordinates[];
}

interface MoneyAmount {
  currencyCode?: unknown;
  amount?: unknown;
}

interface CommercialSourceFile {
  source?: unknown;
  importedAt?: unknown;
  inputFile?: unknown;
  neighbourhoodsFile?: unknown;
  estimatedInvestmentCostModel?: unknown;
  estimatedCarbonOffsetModel?: unknown;
  featureCount?: unknown;
  geoJson?: GeoJsonFeatureCollection;
}

interface NeighbourhoodStats {
  key: string;
  neighbourhoodName: string;
  neighbourhoodNumber: string | null;
  commercialBuildingCount: number;
  energyDataBuildingCount: number;
  investmentDataBuildingCount: number;
  estimatedCo2DataBuildingCount: number;
  googleCo2DataBuildingCount: number;
  totalYearlyEnergyDcKwh: number;
  totalInvestmentBrl: number;
  totalEstimatedCo2SavingsKgPerYear: number;
  totalGoogleCo2SavingsKgPerYear: number;
  investmentCurrencyCode: string | null;
}

function parseArgs(argv: string[]): AggregateOptions {
  let inputPath = DEFAULT_INPUT_FILE;
  let outputPath = DEFAULT_OUTPUT_FILE;
  let neighbourhoodsPath = DEFAULT_NEIGHBOURHOODS_FILE;
  let includeEmpty = false;

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
    if (arg === "--include-empty") {
      includeEmpty = true;
    }
  }

  return {
    inputPath: path.resolve(inputPath),
    outputPath: path.resolve(outputPath),
    neighbourhoodsPath: path.resolve(neighbourhoodsPath),
    includeEmpty,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toFiniteNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getCurrencyAmount(value: unknown): { currencyCode: string | null; amount: number | null } {
  if (!value || typeof value !== "object") {
    return { currencyCode: null, amount: null };
  }

  const money = value as MoneyAmount;
  return {
    currencyCode: toStringValue(money.currencyCode) ?? null,
    amount: toFiniteNumber(money.amount),
  };
}

function makeNeighbourhoodKey(name: string, number: string | null): string {
  return `${number ?? ""}::${name.trim().toLowerCase()}`;
}

function roundValue(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function extractFeatureCollection(raw: unknown): GeoJsonFeatureCollection {
  if (raw && typeof raw === "object") {
    const source = raw as CommercialSourceFile;
    if (source.geoJson?.type === "FeatureCollection" && Array.isArray(source.geoJson.features)) {
      return source.geoJson;
    }

    const candidate = raw as GeoJsonFeatureCollection;
    if (candidate.type === "FeatureCollection" && Array.isArray(candidate.features)) {
      return candidate;
    }
  }

  throw new Error("Input file does not contain a GeoJSON FeatureCollection.");
}

function collectPolygons(geometry: SupportedGeometry | null | undefined): PolygonCoordinates[] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return [...geometry.coordinates];
  return [];
}

function buildMergedGeometry(polygons: PolygonCoordinates[]): SupportedGeometry | null {
  if (polygons.length === 0) return null;
  if (polygons.length === 1) {
    return {
      type: "Polygon",
      coordinates: polygons[0],
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: polygons,
  };
}

async function loadNeighbourhoodBoundaries(
  neighbourhoodsPath: string
): Promise<Map<string, BoundaryGroup>> {
  const raw = JSON.parse(await fs.readFile(neighbourhoodsPath, "utf8")) as GeoJsonFeatureCollection;
  const features = Array.isArray(raw.features) ? raw.features : [];
  const groups = new Map<string, BoundaryGroup>();

  for (const feature of features) {
    const props = feature.properties ?? {};
    const neighbourhoodName =
      toStringValue(props.neighbourhood_name) ??
      toStringValue(props.neighbourhoodName) ??
      toStringValue(props.name);
    const neighbourhoodNumber =
      toStringValue(props.neighbourhood_number) ?? toStringValue(props.neighbourhoodNumber);
    const polygons = collectPolygons(feature.geometry);

    if (!neighbourhoodName || polygons.length === 0) {
      continue;
    }

    const key = makeNeighbourhoodKey(neighbourhoodName, neighbourhoodNumber);
    const existing = groups.get(key);
    if (existing) {
      existing.polygons.push(...polygons);
      continue;
    }

    groups.set(key, {
      key,
      neighbourhoodName,
      neighbourhoodNumber,
      polygons: [...polygons],
    });
  }

  if (groups.size === 0) {
    throw new Error(`No valid neighbourhood polygons found in ${neighbourhoodsPath}`);
  }

  return groups;
}

function createEmptyStats(boundary: BoundaryGroup): NeighbourhoodStats {
  return {
    key: boundary.key,
    neighbourhoodName: boundary.neighbourhoodName,
    neighbourhoodNumber: boundary.neighbourhoodNumber,
    commercialBuildingCount: 0,
    energyDataBuildingCount: 0,
    investmentDataBuildingCount: 0,
    estimatedCo2DataBuildingCount: 0,
    googleCo2DataBuildingCount: 0,
    totalYearlyEnergyDcKwh: 0,
    totalInvestmentBrl: 0,
    totalEstimatedCo2SavingsKgPerYear: 0,
    totalGoogleCo2SavingsKgPerYear: 0,
    investmentCurrencyCode: null,
  };
}

function buildNeighbourhoodStats(
  featureCollection: GeoJsonFeatureCollection
): {
  statsByKey: Map<string, NeighbourhoodStats>;
  unassignedBuildingCount: number;
} {
  const features = Array.isArray(featureCollection.features) ? featureCollection.features : [];
  const statsByKey = new Map<string, NeighbourhoodStats>();
  let unassignedBuildingCount = 0;

  for (const feature of features) {
    const props = feature.properties ?? {};
    const neighbourhoodName =
      toStringValue(props.neighbourhoodName) ?? toStringValue(props.neighbourhood_name);
    const neighbourhoodNumber =
      toStringValue(props.neighbourhoodNumber) ?? toStringValue(props.neighbourhood_number);

    if (!neighbourhoodName) {
      unassignedBuildingCount += 1;
      continue;
    }

    const key = makeNeighbourhoodKey(neighbourhoodName, neighbourhoodNumber);
    let stats = statsByKey.get(key);
    if (!stats) {
      stats = {
        key,
        neighbourhoodName,
        neighbourhoodNumber,
        commercialBuildingCount: 0,
        energyDataBuildingCount: 0,
        investmentDataBuildingCount: 0,
        estimatedCo2DataBuildingCount: 0,
        googleCo2DataBuildingCount: 0,
        totalYearlyEnergyDcKwh: 0,
        totalInvestmentBrl: 0,
        totalEstimatedCo2SavingsKgPerYear: 0,
        totalGoogleCo2SavingsKgPerYear: 0,
        investmentCurrencyCode: null,
      };
      statsByKey.set(key, stats);
    }

    stats.commercialBuildingCount += 1;

    const yearlyEnergy = toFiniteNumber(props.maxYearlyEnergyDcKwh);
    if (yearlyEnergy !== null) {
      stats.energyDataBuildingCount += 1;
      stats.totalYearlyEnergyDcKwh += yearlyEnergy;
    }

    const estimatedCo2 = toFiniteNumber(props.estimatedCarbonOffsetKgPerYear);
    if (estimatedCo2 !== null) {
      stats.estimatedCo2DataBuildingCount += 1;
      stats.totalEstimatedCo2SavingsKgPerYear += estimatedCo2;
    }

    const googleCo2 = toFiniteNumber(props.carbonOffsetKgPerYear);
    if (googleCo2 !== null) {
      stats.googleCo2DataBuildingCount += 1;
      stats.totalGoogleCo2SavingsKgPerYear += googleCo2;
    }

    const investment = getCurrencyAmount(props.estimatedInvestmentCost);
    if (investment.amount !== null) {
      stats.investmentDataBuildingCount += 1;
      stats.totalInvestmentBrl += investment.amount;
      stats.investmentCurrencyCode = investment.currencyCode ?? stats.investmentCurrencyCode;
    }
  }

  return {
    statsByKey,
    unassignedBuildingCount,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const inputRaw = JSON.parse(await fs.readFile(options.inputPath, "utf8")) as CommercialSourceFile;
  const featureCollection = extractFeatureCollection(inputRaw);
  const boundaryGroups = await loadNeighbourhoodBoundaries(options.neighbourhoodsPath);
  const { statsByKey, unassignedBuildingCount } = buildNeighbourhoodStats(featureCollection);

  const sourceFeatures = Array.isArray(featureCollection.features) ? featureCollection.features : [];
  const outputFeatures: GeoJsonFeature[] = [];
  const missingBoundaryNeighbourhoods: string[] = [];

  if (options.includeEmpty) {
    for (const boundary of Array.from(boundaryGroups.values())) {
      if (!statsByKey.has(boundary.key)) {
        statsByKey.set(boundary.key, createEmptyStats(boundary));
      }
    }
  }

  const orderedStats = Array.from(statsByKey.values()).sort((left, right) =>
    left.neighbourhoodName.localeCompare(right.neighbourhoodName)
  );

  for (const stats of orderedStats) {
    const boundary = boundaryGroups.get(stats.key);
    if (!boundary && !options.includeEmpty) {
      missingBoundaryNeighbourhoods.push(stats.neighbourhoodName);
    }

    outputFeatures.push({
      type: "Feature",
      geometry: buildMergedGeometry(boundary?.polygons ?? []),
      properties: {
        neighbourhood_name: stats.neighbourhoodName,
        neighbourhood_number: stats.neighbourhoodNumber,
        commercial_building_count: stats.commercialBuildingCount,
        energy_data_building_count: stats.energyDataBuildingCount,
        investment_data_building_count: stats.investmentDataBuildingCount,
        co2_data_building_count: stats.estimatedCo2DataBuildingCount,
        google_co2_data_building_count: stats.googleCo2DataBuildingCount,
        total_yearly_energy_dc_kwh: roundValue(stats.totalYearlyEnergyDcKwh, 3),
        total_yearly_energy_dc_mwh: roundValue(stats.totalYearlyEnergyDcKwh / 1000, 3),
        total_investment_brl: roundValue(stats.totalInvestmentBrl, 2),
        total_estimated_co2_savings_kg_per_year: roundValue(
          stats.totalEstimatedCo2SavingsKgPerYear,
          3
        ),
        total_estimated_co2_savings_tonnes_per_year: roundValue(
          stats.totalEstimatedCo2SavingsKgPerYear / 1000,
          3
        ),
        total_google_co2_savings_kg_per_year: roundValue(
          stats.totalGoogleCo2SavingsKgPerYear,
          3
        ),
        total_google_co2_savings_tonnes_per_year: roundValue(
          stats.totalGoogleCo2SavingsKgPerYear / 1000,
          3
        ),
        investment_currency_code: stats.investmentCurrencyCode ?? "BRL",
      },
    });
  }

  const totals = orderedStats.reduce(
    (acc, stats) => {
      acc.commercialBuildingCount += stats.commercialBuildingCount;
      acc.totalYearlyEnergyDcKwh += stats.totalYearlyEnergyDcKwh;
      acc.totalInvestmentBrl += stats.totalInvestmentBrl;
      acc.totalEstimatedCo2SavingsKgPerYear += stats.totalEstimatedCo2SavingsKgPerYear;
      acc.totalGoogleCo2SavingsKgPerYear += stats.totalGoogleCo2SavingsKgPerYear;
      return acc;
    },
    {
      commercialBuildingCount: 0,
      totalYearlyEnergyDcKwh: 0,
      totalInvestmentBrl: 0,
      totalEstimatedCo2SavingsKgPerYear: 0,
      totalGoogleCo2SavingsKgPerYear: 0,
    }
  );

  const payload = {
    source: "google-solar-commercial-neighbourhood-aggregation",
    generatedAt: new Date().toISOString(),
    inputFile: options.inputPath,
    outputFile: options.outputPath,
    neighbourhoodsFile: options.neighbourhoodsPath,
    sourceImportedAt: toStringValue(inputRaw.importedAt),
    sourceFeatureCount: sourceFeatures.length,
    neighbourhoodFeatureCount: outputFeatures.length,
    includeEmpty: options.includeEmpty,
    estimatedInvestmentCostModel: inputRaw.estimatedInvestmentCostModel ?? null,
    estimatedCarbonOffsetModel: inputRaw.estimatedCarbonOffsetModel ?? null,
    summary: {
      totalCommercialBuildingCount: totals.commercialBuildingCount,
      totalYearlyEnergyDcKwh: roundValue(totals.totalYearlyEnergyDcKwh, 3),
      totalYearlyEnergyDcMwh: roundValue(totals.totalYearlyEnergyDcKwh / 1000, 3),
      totalInvestmentBrl: roundValue(totals.totalInvestmentBrl, 2),
      totalEstimatedCo2SavingsKgPerYear: roundValue(
        totals.totalEstimatedCo2SavingsKgPerYear,
        3
      ),
      totalEstimatedCo2SavingsTonnesPerYear: roundValue(
        totals.totalEstimatedCo2SavingsKgPerYear / 1000,
        3
      ),
      totalGoogleCo2SavingsKgPerYear: roundValue(totals.totalGoogleCo2SavingsKgPerYear, 3),
      totalGoogleCo2SavingsTonnesPerYear: roundValue(
        totals.totalGoogleCo2SavingsKgPerYear / 1000,
        3
      ),
      unassignedBuildingCount,
      missingBoundaryCount: missingBoundaryNeighbourhoods.length,
      missingBoundaryNeighbourhoods,
    },
    geoJson: {
      type: "FeatureCollection",
      features: outputFeatures,
    },
  };

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await fs.writeFile(options.outputPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    `[solar-aggregate] Wrote ${outputFeatures.length} neighbourhood features to ${path.relative(process.cwd(), options.outputPath)}`
  );
  console.log(
    `[solar-aggregate] Totals: ${formatNumber(totals.totalYearlyEnergyDcKwh, 2)} kWh/year | BRL ${formatNumber(totals.totalInvestmentBrl, 2)} | ${formatNumber(totals.totalEstimatedCo2SavingsKgPerYear / 1000, 3)} tCO2/year`
  );

  const ranked = [...orderedStats].sort(
    (left, right) => right.totalYearlyEnergyDcKwh - left.totalYearlyEnergyDcKwh
  );
  for (const stats of ranked) {
    console.log(
      `[solar-aggregate] ${stats.neighbourhoodName}: ${stats.commercialBuildingCount} buildings | ${formatNumber(stats.totalYearlyEnergyDcKwh, 2)} kWh/year | BRL ${formatNumber(stats.totalInvestmentBrl, 2)} | ${formatNumber(stats.totalEstimatedCo2SavingsKgPerYear / 1000, 3)} tCO2/year`
    );
  }
}

main().catch((error) => {
  console.error("[solar-aggregate] Failed:", error);
  process.exitCode = 1;
});

import fs from "fs/promises";
import path from "path";

const DEFAULT_INPUT_DIR = "client/public/sample-data";
const DEFAULT_OUTPUT_FILE =
  "client/public/sample-data/porto-alegre-google-solar-commercial-buildings.current.json";

interface GeoJsonFeature {
  type?: string;
  geometry?: unknown;
  properties?: Record<string, unknown>;
}

interface GeoJsonFeatureCollection {
  type?: string;
  features?: GeoJsonFeature[];
}

interface CommercialSolarSourceFile {
  source?: unknown;
  importedAt?: unknown;
  inputFile?: unknown;
  estimatedInvestmentCostModel?: unknown;
  estimatedCarbonOffsetModel?: unknown;
  selectedNeighbourhoods?: unknown;
  unmatched?: unknown;
  geoJson?: GeoJsonFeatureCollection;
}

interface MergeOptions {
  inputPaths: string[];
  inputDir: string;
  outputPath: string;
  listInputs: boolean;
}

interface CarbonOffsetModel {
  gridEmissionFactorKgCo2ePerMwh?: unknown;
  gridEmissionFactorKgCo2ePerKwh?: unknown;
}

function toStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveCliPath(value: string): string {
  return path.resolve(value);
}

function parseArgs(argv: string[]): MergeOptions {
  const inputPaths: string[] = [];
  let inputDir = DEFAULT_INPUT_DIR;
  let outputPath = DEFAULT_OUTPUT_FILE;
  let listInputs = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      inputPaths.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--input-dir" && argv[i + 1]) {
      inputDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--list-inputs") {
      listInputs = true;
    }
  }

  return {
    inputPaths: inputPaths.map(resolveCliPath),
    inputDir: resolveCliPath(inputDir),
    outputPath: resolveCliPath(outputPath),
    listInputs,
  };
}

async function discoverInputPaths(inputDir: string, outputPath: string): Promise<string[]> {
  const filenames = await fs.readdir(inputDir);
  return filenames
    .filter((filename) => filename.startsWith("porto-alegre-google-solar-commercial-buildings"))
    .filter((filename) => filename.endsWith(".json"))
    .filter((filename) => !filename.includes("smoke"))
    .filter((filename) => !filename.endsWith(".current.json"))
    .filter((filename) => resolveCliPath(path.join(inputDir, filename)) !== outputPath)
    .sort()
    .map((filename) => resolveCliPath(path.join(inputDir, filename)));
}

function extractFeatureCollection(source: CommercialSolarSourceFile): GeoJsonFeatureCollection {
  if (source.geoJson?.type === "FeatureCollection" && Array.isArray(source.geoJson.features)) {
    return source.geoJson;
  }

  const root = source as unknown as GeoJsonFeatureCollection;
  if (root.type === "FeatureCollection" && Array.isArray(root.features)) {
    return root;
  }

  throw new Error("Commercial solar file does not contain a GeoJSON FeatureCollection.");
}

function getFeatureKey(feature: GeoJsonFeature): string {
  const properties = feature.properties ?? {};
  const buildingId = properties.commercialBuildingId;
  if (
    typeof buildingId === "number" ||
    (typeof buildingId === "string" && buildingId.trim().length > 0)
  ) {
    return `commercialBuildingId:${String(buildingId)}`;
  }

  const lat = properties.sourceLat;
  const lng = properties.sourceLng;
  const neighbourhood = toStringValue(properties.neighbourhoodName) ?? "unknown";
  return `coordinate:${String(lat)}:${String(lng)}:${neighbourhood}`;
}

function getNeighbourhoodName(feature: GeoJsonFeature): string {
  const properties = feature.properties ?? {};
  return (
    toStringValue(properties.neighbourhoodName) ??
    toStringValue(properties.neighbourhood_name) ??
    "Unknown"
  );
}

function compareFeatureOrder(left: GeoJsonFeature, right: GeoJsonFeature): number {
  const leftNeighbourhood = getNeighbourhoodName(left);
  const rightNeighbourhood = getNeighbourhoodName(right);
  const neighbourhoodComparison = leftNeighbourhood.localeCompare(rightNeighbourhood);
  if (neighbourhoodComparison !== 0) return neighbourhoodComparison;

  const leftId = String(left.properties?.commercialBuildingId ?? "");
  const rightId = String(right.properties?.commercialBuildingId ?? "");
  return leftId.localeCompare(rightId, undefined, { numeric: true });
}

function stripRawGoogleBuildingInsights(feature: GeoJsonFeature): GeoJsonFeature {
  const properties = feature.properties ?? {};
  if (!("googleBuildingInsights" in properties)) {
    return feature;
  }

  const { googleBuildingInsights: _ignored, ...rest } = properties;
  return {
    ...feature,
    properties: rest,
  };
}

function getEstimatedCarbonFactorKgPerKwh(model: unknown): number | null {
  if (!model || typeof model !== "object") return null;

  const candidate = model as CarbonOffsetModel;
  if (
    typeof candidate.gridEmissionFactorKgCo2ePerKwh === "number" &&
    Number.isFinite(candidate.gridEmissionFactorKgCo2ePerKwh)
  ) {
    return candidate.gridEmissionFactorKgCo2ePerKwh;
  }

  if (
    typeof candidate.gridEmissionFactorKgCo2ePerMwh === "number" &&
    Number.isFinite(candidate.gridEmissionFactorKgCo2ePerMwh)
  ) {
    return candidate.gridEmissionFactorKgCo2ePerMwh / 1000;
  }

  return null;
}

function normalizeEstimatedCarbonOffset(
  feature: GeoJsonFeature,
  estimatedCarbonOffsetModel: unknown
): GeoJsonFeature {
  const properties = feature.properties ?? {};
  const maxYearlyEnergyDcKwh = properties.maxYearlyEnergyDcKwh;
  const carbonFactorKgPerKwh = getEstimatedCarbonFactorKgPerKwh(estimatedCarbonOffsetModel);

  if (
    typeof maxYearlyEnergyDcKwh !== "number" ||
    !Number.isFinite(maxYearlyEnergyDcKwh) ||
    carbonFactorKgPerKwh === null
  ) {
    return feature;
  }

  return {
    ...feature,
    properties: {
      ...properties,
      estimatedCarbonOffsetKgPerYear: maxYearlyEnergyDcKwh * carbonFactorKgPerKwh,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPaths =
    options.inputPaths.length > 0
      ? options.inputPaths
      : await discoverInputPaths(options.inputDir, options.outputPath);

  if (options.listInputs) {
    for (const inputPath of inputPaths) {
      console.log(path.relative(process.cwd(), inputPath));
    }
    return;
  }

  if (inputPaths.length === 0) {
    throw new Error(
      "No commercial building files found to merge. Use --input or place completed files in client/public/sample-data."
    );
  }

  const mergedFeatures = new Map<string, GeoJsonFeature>();
  const selectedNeighbourhoods = new Set<string>();
  const unmatchedRows: any[] = [];
  const unmatchedKeys = new Set<string>();
  const sourceImports: string[] = [];
  const inputFiles: string[] = [];
  let inputFeatureCountTotal = 0;
  let estimatedInvestmentCostModel: unknown = null;
  let estimatedCarbonOffsetModel: unknown = null;

  for (const inputPath of inputPaths) {
    const raw = JSON.parse(await fs.readFile(inputPath, "utf8")) as CommercialSolarSourceFile;
    const featureCollection = extractFeatureCollection(raw);
    const features = Array.isArray(featureCollection.features) ? featureCollection.features : [];
    inputFeatureCountTotal += features.length;
    inputFiles.push(path.relative(process.cwd(), inputPath));

    const importedAt = toStringValue(raw.importedAt);
    if (importedAt) {
      sourceImports.push(importedAt);
    }

    if (estimatedInvestmentCostModel === null && raw.estimatedInvestmentCostModel != null) {
      estimatedInvestmentCostModel = raw.estimatedInvestmentCostModel;
    }
    if (estimatedCarbonOffsetModel === null && raw.estimatedCarbonOffsetModel != null) {
      estimatedCarbonOffsetModel = raw.estimatedCarbonOffsetModel;
    }

    const sourceNeighbourhoods = Array.isArray(raw.selectedNeighbourhoods)
      ? raw.selectedNeighbourhoods
      : [];
    for (const neighbourhood of sourceNeighbourhoods) {
      const value = toStringValue(neighbourhood);
      if (value) selectedNeighbourhoods.add(value);
    }

    for (const feature of features) {
      const key = getFeatureKey(feature);
      mergedFeatures.set(key, stripRawGoogleBuildingInsights(feature));
    }

    const sourceUnmatched = Array.isArray(raw.unmatched) ? raw.unmatched : [];
    for (const row of sourceUnmatched) {
      const rowId =
        typeof row?.commercialBuildingId === "number" ||
        typeof row?.commercialBuildingId === "string"
          ? `commercialBuildingId:${String(row.commercialBuildingId)}`
          : JSON.stringify(row);
      if (unmatchedKeys.has(rowId)) continue;
      unmatchedKeys.add(rowId);
      unmatchedRows.push(row);
    }
  }

  const features = Array.from(mergedFeatures.values())
    .map((feature) => normalizeEstimatedCarbonOffset(feature, estimatedCarbonOffsetModel))
    .sort(compareFeatureOrder);
  const featureCountByNeighbourhood: Record<string, number> = {};
  for (const feature of features) {
    const neighbourhoodName = getNeighbourhoodName(feature);
    featureCountByNeighbourhood[neighbourhoodName] =
      (featureCountByNeighbourhood[neighbourhoodName] ?? 0) + 1;
    if (neighbourhoodName !== "Unknown") {
      selectedNeighbourhoods.add(neighbourhoodName);
    }
  }

  const output = {
    source: "google-solar-commercial-merged",
    mergedAt: new Date().toISOString(),
    inputFiles,
    inputFeatureCountTotal,
    mergedFeatureCount: features.length,
    duplicateFeatureCountRemoved: inputFeatureCountTotal - features.length,
    includeRawGoogleBuildingInsights: false,
    estimatedInvestmentCostModel,
    estimatedCarbonOffsetModel,
    sourceImports,
    selectedNeighbourhoods: Array.from(selectedNeighbourhoods).sort((left, right) =>
      left.localeCompare(right)
    ),
    featureCountByNeighbourhood,
    unmatchedCount: unmatchedRows.length,
    geoJson: {
      type: "FeatureCollection",
      features,
    },
    unmatched: unmatchedRows,
  };

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await fs.writeFile(options.outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(
    `[solar-merge] Wrote ${features.length} merged commercial building features to ${path.relative(process.cwd(), options.outputPath)}`
  );
  console.log(
    `[solar-merge] Merged ${inputPaths.length} input files and removed ${inputFeatureCountTotal - features.length} duplicates`
  );
  console.log(
    `[solar-merge] Included neighbourhoods: ${Array.from(selectedNeighbourhoods)
      .sort((left, right) => left.localeCompare(right))
      .join(", ")}`
  );
}

main().catch((error) => {
  console.error("[solar-merge] Failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

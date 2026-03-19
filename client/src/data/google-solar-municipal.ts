export const MUNICIPAL_SOLAR_PRIORITY_LAYER_IDS = [
  "google_solar_municipal_high",
  "google_solar_municipal_medium",
  "google_solar_municipal_low",
] as const;

export type MunicipalSolarPriorityLayerId =
  (typeof MUNICIPAL_SOLAR_PRIORITY_LAYER_IDS)[number];

export type MunicipalSolarPriorityTier = "high" | "medium" | "low";

const MUNICIPAL_SOLAR_PRIORITY_LAYER_TO_TIER: Record<
  MunicipalSolarPriorityLayerId,
  MunicipalSolarPriorityTier
> = {
  google_solar_municipal_high: "high",
  google_solar_municipal_medium: "medium",
  google_solar_municipal_low: "low",
};

export const MUNICIPAL_SOLAR_PRIORITY_LABELS: Record<
  MunicipalSolarPriorityTier,
  string
> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const MUNICIPAL_SOLAR_PRIORITY_DESCRIPTIONS: Record<
  MunicipalSolarPriorityTier,
  string
> = {
  high: "Top 20% by composite score: largest rooftops and highest solar generation.",
  medium: "Next 40%: strong solar candidates with moderate constraints.",
  low: "Remaining 40%: lower-return sites kept for full city coverage.",
};

export const MUNICIPAL_SOLAR_PRIORITY_COLORS: Record<
  MunicipalSolarPriorityTier,
  string
> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#38bdf8",
};

const HIGH_SHARE = 0.2;
const HIGH_PLUS_MEDIUM_SHARE = 0.6;

interface MunicipalSolarPriorityBucket {
  count: number;
  minScore: number | null;
  maxScore: number | null;
}

export interface MunicipalSolarPrioritySummary {
  totalBuildings: number;
  scoreMethod: string;
  high: MunicipalSolarPriorityBucket;
  medium: MunicipalSolarPriorityBucket;
  low: MunicipalSolarPriorityBucket;
}

interface RankedFeature {
  feature: any;
  score: number;
  annualEnergyKwh: number | null;
  roofAreaM2: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getGeoJson(data: any): any {
  return data?.type === "FeatureCollection" ? data : data?.geoJson || data;
}

function firstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (isFiniteNumber(value)) return value;
  }
  return null;
}

function getAnnualEnergyKwh(feature: any): number | null {
  const properties = feature?.properties || {};
  const configs = properties.googleBuildingInsights?.solarPotential?.solarPanelConfigs;
  const bestConfig = Array.isArray(configs)
    ? configs.reduce((best: any, current: any) => {
        if (!best) return current;
        const bestEnergy = isFiniteNumber(best?.yearlyEnergyDcKwh)
          ? best.yearlyEnergyDcKwh
          : -1;
        const currentEnergy = isFiniteNumber(current?.yearlyEnergyDcKwh)
          ? current.yearlyEnergyDcKwh
          : -1;
        if (currentEnergy !== bestEnergy) {
          return currentEnergy > bestEnergy ? current : best;
        }
        const bestPanels = isFiniteNumber(best?.panelsCount) ? best.panelsCount : -1;
        const currentPanels = isFiniteNumber(current?.panelsCount)
          ? current.panelsCount
          : -1;
        return currentPanels > bestPanels ? current : best;
      }, null)
    : null;

  return firstFiniteNumber(
    properties.priorityAnnualEnergyKwh,
    properties.maxYearlyEnergyDcKwh,
    bestConfig?.yearlyEnergyDcKwh
  );
}

function getRoofAreaM2(feature: any): number | null {
  const properties = feature?.properties || {};
  const solarPotential = properties.googleBuildingInsights?.solarPotential;
  return firstFiniteNumber(
    properties.priorityRoofAreaM2,
    properties.maxArrayAreaMeters2,
    solarPotential?.maxArrayAreaMeters2,
    solarPotential?.wholeRoofStats?.areaMeters2
  );
}

function normalize(value: number | null, minValue: number, maxValue: number): number | null {
  if (!isFiniteNumber(value)) return null;
  if (maxValue <= minValue) return 1;
  return (value - minValue) / (maxValue - minValue);
}

function roundTo(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function compareNumberDesc(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function getMunicipalBuildingId(feature: any): number | string {
  const id = feature?.properties?.municipalBuildingId;
  if (typeof id === "number" || typeof id === "string") return id;
  return "";
}

function summarizeBucket(
  ranked: Array<RankedFeature & { tier: MunicipalSolarPriorityTier }>,
  tier: MunicipalSolarPriorityTier
): MunicipalSolarPriorityBucket {
  const scores = ranked
    .filter((feature) => feature.tier === tier)
    .map((feature) => feature.score);

  if (scores.length === 0) {
    return { count: 0, minScore: null, maxScore: null };
  }

  return {
    count: scores.length,
    minScore: roundTo(Math.min(...scores)),
    maxScore: roundTo(Math.max(...scores)),
  };
}

export function isMunicipalSolarPriorityLayerId(
  layerId: string
): layerId is MunicipalSolarPriorityLayerId {
  return (MUNICIPAL_SOLAR_PRIORITY_LAYER_IDS as readonly string[]).includes(layerId);
}

export function getMunicipalSolarPriorityTier(
  layerId: string
): MunicipalSolarPriorityTier | null {
  if (!isMunicipalSolarPriorityLayerId(layerId)) return null;
  return MUNICIPAL_SOLAR_PRIORITY_LAYER_TO_TIER[layerId];
}

export function buildMunicipalSolarPriorityLayers(
  sourceData: any
): Record<MunicipalSolarPriorityLayerId, any> {
  const emptyResult = Object.fromEntries(
    MUNICIPAL_SOLAR_PRIORITY_LAYER_IDS.map((layerId) => [layerId, null])
  ) as Record<MunicipalSolarPriorityLayerId, any>;

  const geoJson = getGeoJson(sourceData);
  if (!geoJson?.features || !Array.isArray(geoJson.features)) return emptyResult;

  const features = geoJson.features;
  const annualEnergyValues = features
    .map((feature: any) => getAnnualEnergyKwh(feature))
    .filter(isFiniteNumber);
  const roofAreaValues = features
    .map((feature: any) => getRoofAreaM2(feature))
    .filter(isFiniteNumber);

  const minAnnualEnergy =
    annualEnergyValues.length > 0 ? Math.min(...annualEnergyValues) : 0;
  const maxAnnualEnergy =
    annualEnergyValues.length > 0 ? Math.max(...annualEnergyValues) : 0;
  const minRoofArea = roofAreaValues.length > 0 ? Math.min(...roofAreaValues) : 0;
  const maxRoofArea = roofAreaValues.length > 0 ? Math.max(...roofAreaValues) : 0;

  const ranked = features
    .map((feature: any) => {
      const annualEnergyKwh = getAnnualEnergyKwh(feature);
      const roofAreaM2 = getRoofAreaM2(feature);
      const normalizedEnergy = normalize(
        annualEnergyKwh,
        minAnnualEnergy,
        maxAnnualEnergy
      );
      const normalizedRoofArea = normalize(roofAreaM2, minRoofArea, maxRoofArea);
      const availableComponents = [normalizedEnergy, normalizedRoofArea].filter(
        isFiniteNumber
      );
      const score =
        availableComponents.length > 0
          ? (availableComponents.reduce((sum, value) => sum + value, 0) /
              availableComponents.length) *
            100
          : 0;

      return {
        feature,
        score,
        annualEnergyKwh,
        roofAreaM2,
      };
    })
    .sort((a, b) => {
      const byScore = compareNumberDesc(a.score, b.score);
      if (byScore !== 0) return byScore;

      const byEnergy = compareNumberDesc(a.annualEnergyKwh, b.annualEnergyKwh);
      if (byEnergy !== 0) return byEnergy;

      const byArea = compareNumberDesc(a.roofAreaM2, b.roofAreaM2);
      if (byArea !== 0) return byArea;

      return String(getMunicipalBuildingId(a.feature)).localeCompare(
        String(getMunicipalBuildingId(b.feature))
      );
    })
    .map((feature, index, rankedFeatures) => {
      const rank = index + 1;
      const totalBuildings = rankedFeatures.length;
      const highCutoff = Math.ceil(totalBuildings * HIGH_SHARE);
      const mediumCutoff = Math.ceil(totalBuildings * HIGH_PLUS_MEDIUM_SHARE);
      const tier: MunicipalSolarPriorityTier =
        rank <= highCutoff ? "high" : rank <= mediumCutoff ? "medium" : "low";

      const properties = feature.feature?.properties || {};
      return {
        ...feature,
        tier,
        feature: {
          ...feature.feature,
          properties: {
            ...properties,
            priorityTier: tier,
            priorityLabel: MUNICIPAL_SOLAR_PRIORITY_LABELS[tier],
            priorityDescription: MUNICIPAL_SOLAR_PRIORITY_DESCRIPTIONS[tier],
            priorityRank: rank,
            priorityScore: roundTo(feature.score),
            priorityPercentile: roundTo((rank / totalBuildings) * 100),
            priorityAnnualEnergyKwh: feature.annualEnergyKwh,
            priorityRoofAreaM2: feature.roofAreaM2,
          },
        },
      };
    });

  const summary: MunicipalSolarPrioritySummary = {
    totalBuildings: ranked.length,
    scoreMethod:
      "Priority score = 0.5 × normalized maxYearlyEnergyDcKwh + 0.5 × normalized maxArrayAreaMeters2.",
    high: summarizeBucket(ranked, "high"),
    medium: summarizeBucket(ranked, "medium"),
    low: summarizeBucket(ranked, "low"),
  };

  return MUNICIPAL_SOLAR_PRIORITY_LAYER_IDS.reduce((result, layerId) => {
    const tier = MUNICIPAL_SOLAR_PRIORITY_LAYER_TO_TIER[layerId];
    const filteredFeatures = ranked
      .filter((feature) => feature.tier === tier)
      .map((feature) => feature.feature);
    const baseWrapper =
      sourceData && typeof sourceData === "object" && !Array.isArray(sourceData)
        ? sourceData
        : {};

    result[layerId] = {
      ...baseWrapper,
      featureCount: filteredFeatures.length,
      priorityTier: tier,
      priorityTierSummary: summary,
      geoJson: {
        ...geoJson,
        features: filteredFeatures,
      },
    };
    return result;
  }, emptyResult);
}

export const MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID = "municipal_buildings_solar";

export const MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_TIERS = [
  "high",
  "medium",
  "low",
  "unscored",
] as const;

export type MunicipalBuildingsSolarPriorityTier =
  (typeof MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_TIERS)[number];

export const MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS: Record<
  MunicipalBuildingsSolarPriorityTier,
  string
> = {
  high: "High Priority",
  medium: "Medium Priority",
  low: "Low Priority",
  unscored: "Unscored",
};

export const MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_DESCRIPTIONS: Record<
  MunicipalBuildingsSolarPriorityTier,
  string
> = {
  high: "Top 20% by maximum PV panel count.",
  medium: "Next 50% by maximum PV panel count.",
  low: "Remaining 30% of scored buildings by maximum PV panel count.",
  unscored:
    "Municipal registry records with no current Google Building Insights enrichment, so no panel-count tier can be computed.",
};

export const MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_COLORS: Record<
  MunicipalBuildingsSolarPriorityTier,
  string
> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#38bdf8",
  unscored: "#71717a",
};

const HIGH_SHARE = 0.2;
const HIGH_PLUS_MEDIUM_SHARE = 0.7;

interface MunicipalBuildingsSolarPriorityBucket {
  count: number;
  minScore: number | null;
  maxScore: number | null;
}

export interface MunicipalBuildingsSolarPrioritySummary {
  totalBuildings: number;
  enrichedBuildings: number;
  geocodedOnlyBuildings: number;
  scoreMethod: string;
  high: MunicipalBuildingsSolarPriorityBucket;
  medium: MunicipalBuildingsSolarPriorityBucket;
  low: MunicipalBuildingsSolarPriorityBucket;
  unscored: MunicipalBuildingsSolarPriorityBucket;
}

interface RankedMunicipalSolarFeature {
  feature: any;
  score: number;
  panelCount: number | null;
  annualEnergyKwh: number | null;
  roofAreaM2: number | null;
  tier?: MunicipalBuildingsSolarPriorityTier;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasMoneyAmount(value: unknown): value is { amount: number; currencyCode?: string } {
  if (!value || typeof value !== "object") return false;
  const amount = (value as { amount?: unknown }).amount;
  return isFiniteNumber(amount);
}

function firstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (isFiniteNumber(value)) return value;
  }
  return null;
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

function getGeoJson(data: any): any {
  return data?.type === "FeatureCollection" ? data : data?.geoJson || data;
}

function getFeatureId(feature: any): string {
  const value = feature?.properties?.municipalBuildingId;
  return value === null || value === undefined ? "" : String(value);
}

function getMunicipalBuildingId(feature: any): number | string {
  const value = feature?.properties?.municipalBuildingId;
  if (typeof value === "number" || typeof value === "string") return value;
  return "";
}

export function isMunicipalBuildingsSolarLayerId(layerId: string): boolean {
  return layerId === MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID;
}

export function getMunicipalBuildingsSolarAnnualEnergyKwh(properties: any): number | null {
  const solarPotential = properties?.googleBuildingInsights?.solarPotential;
  const configs = solarPotential?.solarPanelConfigs;
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
    properties?.priorityAnnualEnergyKwh,
    properties?.maxYearlyEnergyDcKwh,
    bestConfig?.yearlyEnergyDcKwh
  );
}

export function getMunicipalBuildingsSolarRoofAreaM2(properties: any): number | null {
  const solarPotential = properties?.googleBuildingInsights?.solarPotential;
  return firstFiniteNumber(
    properties?.priorityRoofAreaM2,
    properties?.maxArrayAreaMeters2,
    solarPotential?.maxArrayAreaMeters2,
    solarPotential?.wholeRoofStats?.areaMeters2
  );
}

export function getMunicipalBuildingsSolarCapacityKw(properties: any): number | null {
  const panelCount = getMunicipalBuildingsSolarPanelCount(properties);
  const panelCapacityWatts = firstFiniteNumber(
    properties?.panelCapacityWatts,
    properties?.googleBuildingInsights?.solarPotential?.panelCapacityWatts
  );

  if (panelCount === null || panelCapacityWatts === null) return null;
  return (panelCount * panelCapacityWatts) / 1000;
}

export function getMunicipalBuildingsSolarPanelCount(properties: any): number | null {
  return firstFiniteNumber(
    properties?.priorityPanelCount,
    properties?.maxArrayPanelsCount,
    properties?.googleBuildingInsights?.solarPotential?.maxArrayPanelsCount
  );
}

export function getMunicipalBuildingsSolarInvestmentAmount(properties: any): number | null {
  const value = properties?.estimatedInvestmentCost;
  if (!hasMoneyAmount(value)) return null;
  return value.amount;
}

export function getMunicipalBuildingsSolarCarbonOffsetKgPerYear(properties: any): number | null {
  return firstFiniteNumber(
    properties?.carbonOffsetKgPerYear,
    properties?.estimatedCarbonOffsetKgPerYear
  );
}

export function getMunicipalBuildingsSolarDisplayName(properties: any): string {
  return (
    properties?.sourceAddress ||
    properties?.matchedAddress ||
    (properties?.municipalBuildingId
      ? `Municipal building #${properties.municipalBuildingId}`
      : "Municipal building")
  );
}

function buildGeocodedOnlySolarFeature(geocodedFeature: any): any {
  const properties = geocodedFeature?.properties || {};
  const coordinates = geocodedFeature?.geometry?.coordinates;
  const sourceLng =
    Array.isArray(coordinates) && isFiniteNumber(coordinates[0]) ? coordinates[0] : null;
  const sourceLat =
    Array.isArray(coordinates) && isFiniteNumber(coordinates[1]) ? coordinates[1] : null;

  return {
    ...geocodedFeature,
    properties: {
      ...properties,
      sourceAddress: properties.sourceAddress ?? properties.matchedAddress ?? null,
      sourceLat,
      sourceLng,
      matchedCenterLat: sourceLat,
      matchedCenterLng: sourceLng,
      matchDistanceMeters: 0,
      importStatus: "seed_only",
      importMessage:
        "No Google Building Insights result is present for this building in the current municipal solar export.",
      googleBuildingName: null,
      imageryQuality: null,
      imageryDate: null,
      imageryProcessedDate: null,
      postalCode: properties.matchedPostalCode ?? null,
      administrativeArea: null,
      statisticalArea: null,
      regionCode: "BR",
      maxSunshineHoursPerYear: null,
      maxArrayPanelsCount: null,
      panelCapacityWatts: null,
      maxYearlyEnergyDcKwh: null,
      sunshineQuantiles: [],
      carbonOffsetFactorKgPerMwh: null,
      estimatedInstalledCostPerPanel: null,
      estimatedInvestmentCost: null,
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
      googleBuildingInsights: null,
    },
  };
}

function mergeMunicipalSolarFeature(solarFeature: any, geocodedFeature: any): any {
  if (!solarFeature && geocodedFeature) {
    return buildGeocodedOnlySolarFeature(geocodedFeature);
  }
  if (solarFeature && !geocodedFeature) {
    return solarFeature;
  }
  if (!solarFeature && !geocodedFeature) return null;

  const solarProperties = solarFeature?.properties || {};
  const geocodedProperties = geocodedFeature?.properties || {};

  return {
    ...solarFeature,
    geometry: solarFeature?.geometry ?? geocodedFeature?.geometry,
    properties: {
      ...geocodedProperties,
      ...solarProperties,
      utilizedBy: solarProperties.utilizedBy ?? geocodedProperties.utilizedBy ?? null,
      sourceAddress:
        solarProperties.sourceAddress ?? geocodedProperties.sourceAddress ?? null,
      matchedAddress:
        solarProperties.matchedAddress ?? geocodedProperties.matchedAddress ?? null,
      matchedPostalCode:
        solarProperties.matchedPostalCode ?? geocodedProperties.matchedPostalCode ?? null,
      sourceStreet: geocodedProperties.sourceStreet ?? null,
      sourceNumber: geocodedProperties.sourceNumber ?? null,
      sourceNeighborhood: geocodedProperties.sourceNeighborhood ?? null,
      sourceCity: geocodedProperties.sourceCity ?? null,
      sourceState: geocodedProperties.sourceState ?? null,
      sourceCountry: geocodedProperties.sourceCountry ?? null,
      locationPrecision: geocodedProperties.locationPrecision ?? null,
      locationSource: geocodedProperties.locationSource ?? null,
      matchStatus: geocodedProperties.matchStatus ?? null,
      matchQueryUsed: geocodedProperties.matchQueryUsed ?? null,
      matchProvider: geocodedProperties.matchProvider ?? null,
      matchScore: geocodedProperties.matchScore ?? null,
      matchAddrType: geocodedProperties.matchAddrType ?? null,
      matchDistrict: geocodedProperties.matchDistrict ?? null,
      importStatus: solarProperties.importStatus ?? "enriched",
      importMessage: solarProperties.importMessage ?? null,
    },
  };
}

function summarizeBucket(
  ranked: Array<RankedMunicipalSolarFeature & { tier: MunicipalBuildingsSolarPriorityTier }>,
  tier: MunicipalBuildingsSolarPriorityTier
): MunicipalBuildingsSolarPriorityBucket {
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

function hasPriorityPanelCount(panelCount: number | null): boolean {
  return panelCount !== null;
}

export function buildMunicipalBuildingsSolarLayerData(
  geocodedSource: any,
  solarSource: any
): any {
  const geocodedGeoJson = getGeoJson(geocodedSource);
  const solarGeoJson = getGeoJson(solarSource);
  const geocodedFeatures = Array.isArray(geocodedGeoJson?.features)
    ? geocodedGeoJson.features
    : [];
  const solarFeatures = Array.isArray(solarGeoJson?.features) ? solarGeoJson.features : [];

  const geocodedById = new Map<string, any>();
  const solarById = new Map<string, any>();

  geocodedFeatures.forEach((feature: any) => {
    const featureId = getFeatureId(feature);
    if (featureId) geocodedById.set(featureId, feature);
  });
  solarFeatures.forEach((feature: any) => {
    const featureId = getFeatureId(feature);
    if (featureId) solarById.set(featureId, feature);
  });

  const unionIds = Array.from(
    new Set<string>([
      ...Array.from(geocodedById.keys()),
      ...Array.from(solarById.keys()),
    ])
  );

  const mergedFeatures = unionIds
    .map((featureId) =>
      mergeMunicipalSolarFeature(solarById.get(featureId), geocodedById.get(featureId))
    )
    .filter(Boolean);

  const ranked = mergedFeatures
    .map((feature: any): RankedMunicipalSolarFeature => {
      const panelCount = getMunicipalBuildingsSolarPanelCount(feature?.properties);
      const annualEnergyKwh = getMunicipalBuildingsSolarAnnualEnergyKwh(
        feature?.properties
      );
      const roofAreaM2 = getMunicipalBuildingsSolarRoofAreaM2(feature?.properties);

      return {
        feature,
        score: panelCount ?? 0,
        panelCount,
        annualEnergyKwh,
        roofAreaM2,
      };
    })
    .filter((feature) => hasPriorityPanelCount(feature.panelCount))
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
    .map((rankedFeature, index, rankedFeatures) => {
      const rank = index + 1;
      const totalRankedBuildings = rankedFeatures.length;
      const highCutoff = Math.ceil(totalRankedBuildings * HIGH_SHARE);
      const mediumCutoff = Math.ceil(totalRankedBuildings * HIGH_PLUS_MEDIUM_SHARE);
      const tier: MunicipalBuildingsSolarPriorityTier =
        rank <= highCutoff ? "high" : rank <= mediumCutoff ? "medium" : "low";
      const properties = rankedFeature.feature?.properties || {};

      return {
        ...rankedFeature,
        tier,
        feature: {
          ...rankedFeature.feature,
          properties: {
            ...properties,
            priorityTier: tier,
            priorityLabel: MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS[tier],
            priorityDescription: MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_DESCRIPTIONS[tier],
            priorityRank: rank,
            priorityScore: rankedFeature.panelCount,
            priorityPercentile: roundTo((rank / totalRankedBuildings) * 100),
            priorityPanelCount: rankedFeature.panelCount,
            priorityAnnualEnergyKwh: rankedFeature.annualEnergyKwh,
            priorityRoofAreaM2: rankedFeature.roofAreaM2,
            priorityCapacityKw: getMunicipalBuildingsSolarCapacityKw(properties),
            priorityInvestmentBrl: getMunicipalBuildingsSolarInvestmentAmount(properties),
            priorityCarbonOffsetKgPerYear:
              getMunicipalBuildingsSolarCarbonOffsetKgPerYear(properties),
          },
        },
      };
    });

  const rankedIds = new Set(
    ranked.map((feature) => String(getMunicipalBuildingId(feature.feature)))
  );

  const unscored = mergedFeatures
    .filter((feature: any) => !rankedIds.has(String(getMunicipalBuildingId(feature))))
    .map((feature: any) => {
      const properties = feature?.properties || {};
      return {
        feature: {
          ...feature,
          properties: {
            ...properties,
            priorityTier: "unscored" as MunicipalBuildingsSolarPriorityTier,
            priorityLabel: MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS.unscored,
            priorityDescription:
              MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_DESCRIPTIONS.unscored,
            priorityRank: null,
            priorityScore: null,
            priorityPercentile: null,
            priorityPanelCount: null,
            priorityAnnualEnergyKwh: null,
            priorityRoofAreaM2: null,
            priorityCapacityKw: getMunicipalBuildingsSolarCapacityKw(properties),
            priorityInvestmentBrl: getMunicipalBuildingsSolarInvestmentAmount(properties),
            priorityCarbonOffsetKgPerYear:
              getMunicipalBuildingsSolarCarbonOffsetKgPerYear(properties),
          },
        },
      };
    });

  const enrichedBuildings = mergedFeatures.filter(
    (feature: any) => feature?.properties?.importStatus !== "seed_only"
  ).length;
  const geocodedOnlyBuildings = mergedFeatures.length - enrichedBuildings;

  const summary: MunicipalBuildingsSolarPrioritySummary = {
    totalBuildings: mergedFeatures.length,
    enrichedBuildings,
    geocodedOnlyBuildings,
    scoreMethod:
      "Tiering uses maxArrayPanelsCount only. Buildings are ranked descending by the number of PV panels they can host: top 20% High, next 50% Medium, remaining 30% Low. Records without panel counts remain unscored.",
    high: summarizeBucket(ranked as Array<
      RankedMunicipalSolarFeature & { tier: MunicipalBuildingsSolarPriorityTier }
    >, "high"),
    medium: summarizeBucket(ranked as Array<
      RankedMunicipalSolarFeature & { tier: MunicipalBuildingsSolarPriorityTier }
    >, "medium"),
    low: summarizeBucket(ranked as Array<
      RankedMunicipalSolarFeature & { tier: MunicipalBuildingsSolarPriorityTier }
    >, "low"),
    unscored: {
      count: unscored.length,
      minScore: null,
      maxScore: null,
    },
  };

  const baseWrapper =
    solarSource && typeof solarSource === "object" && !Array.isArray(solarSource)
      ? solarSource
      : {};

  return {
    ...baseWrapper,
    source: "municipal-buildings-solar",
    importedAt: solarSource?.importedAt ?? geocodedSource?.generatedAt ?? null,
    totalMatchedRecords:
      solarSource?.totalMatchedRecords ??
      geocodedSource?.matchedRows ??
      summary.totalBuildings,
    featureCount: summary.totalBuildings,
    enrichedCount: enrichedBuildings,
    geocodedOnlyCount: geocodedOnlyBuildings,
    priorityTierSummary: summary,
    geoJson: {
      type: "FeatureCollection",
      features: [
        ...unscored.map((feature) => feature.feature),
        ...ranked
          .filter((feature) => feature.tier === "low")
          .map((feature) => feature.feature),
        ...ranked
          .filter((feature) => feature.tier === "medium")
          .map((feature) => feature.feature),
        ...ranked
          .filter((feature) => feature.tier === "high")
          .map((feature) => feature.feature),
      ],
    },
  };
}

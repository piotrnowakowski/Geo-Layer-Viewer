const SOLAR_NEIGHBOURHOODS_PATH =
  "/sample-data/porto-alegre-google-solar-commercial-neighbourhoods.current.json";
const COMMERCIAL_BUILDINGS_PATH =
  "/sample-data/porto-alegre-google-solar-commercial-buildings.current.json";
const COMMERCIAL_TAX_PATH = "/sample-data/poa-iptu-commercial-tax.geojson";

export type SolarRegulationTier = "high" | "medium" | "low";

export interface SolarRegulationScenario {
  discountRate: number;
  adoptionRate: number;
  revenueLostBrl: number;
  privateInvestmentBrl: number;
  pvInstalledKwp: number;
  annualGenerationMwh: number;
  co2AvoidedTons: number;
}

export interface SolarRegulationNeighbourhood {
  id: string;
  name: string;
  number: string;
  tier: SolarRegulationTier;
  score: number;
  solarPotentialKwp: number;
  annualGenerationMwh: number;
  annualCo2AvoidedTons: number;
  commercialBuildings: number;
  iptuRevenueBrl: number;
  estimatedInvestmentBrl: number;
  taxPerCommercialBuilding: number | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  scenario5: SolarRegulationScenario;
  scenario10: SolarRegulationScenario;
}

export interface SolarRegulationBuilding {
  id: string;
  neighbourhoodNumber: string;
  neighbourhoodName: string;
  lat: number;
  lng: number;
  solarPotentialKwp: number | null;
  annualGenerationMwh: number | null;
  investmentBrl: number | null;
  imageryQuality: string | null;
}

export interface SolarRegulationDataset {
  neighbourhoods: SolarRegulationNeighbourhood[];
  buildings: SolarRegulationBuilding[];
  coveredNeighbourhoodCount: number;
  totalTaxNeighbourhoodCount: number;
}

interface FeatureCollectionLike {
  type?: string;
  features?: any[];
  geoJson?: {
    type?: string;
    features?: any[];
  };
}

interface MergedTaxFeature {
  geometry: GeoJSON.MultiPolygon;
  properties: {
    neighbourhood_number: string;
    neighbourhood_name: string;
    iptu_total_tax: number;
    commercial_buildings_count: number;
    tax_per_commercial_building: number | null;
  };
}

type DraftSolarRegulationNeighbourhood = Omit<
  SolarRegulationNeighbourhood,
  "tier" | "estimatedInvestmentBrl" | "scenario5" | "scenario10"
>;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.json();
}

function getFeatures(data: FeatureCollectionLike): any[] {
  if (Array.isArray(data?.geoJson?.features)) return data.geoJson.features;
  if (Array.isArray(data?.features)) return data.features;
  return [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundTo(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 1;
  return (value - min) / (max - min);
}

function geometryToMultiPolygon(
  geometry: GeoJSON.Geometry | null | undefined
): number[][][][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") {
    return [geometry.coordinates as number[][][]];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates as number[][][][];
  }
  return [];
}

function mergeTaxFeatures(features: any[]): MergedTaxFeature[] {
  const grouped = new Map<string, MergedTaxFeature>();

  for (const feature of features) {
    const properties = feature?.properties || {};
    const number = String(properties.neighbourhood_number || "").trim();
    if (!number) continue;

    const geometryCoords = geometryToMultiPolygon(feature?.geometry);
    const existing = grouped.get(number);

    if (!existing) {
      grouped.set(number, {
        geometry: {
          type: "MultiPolygon",
          coordinates: [...geometryCoords],
        },
        properties: {
          neighbourhood_number: number,
          neighbourhood_name: properties.neighbourhood_name || "Unknown",
          iptu_total_tax: asNumber(properties.iptu_total_tax) ?? 0,
          commercial_buildings_count:
            asNumber(properties.commercial_buildings_count) ?? 0,
          tax_per_commercial_building: asNumber(
            properties.tax_per_commercial_building
          ),
        },
      });
      continue;
    }

    existing.geometry.coordinates.push(...geometryCoords);
  }

  return Array.from(grouped.values());
}

function buildScenario(
  discountRate: number,
  solarPotentialKwp: number,
  annualGenerationMwh: number,
  annualCo2AvoidedTons: number,
  iptuRevenueBrl: number,
  estimatedInvestmentBrl: number
): SolarRegulationScenario {
  const adoptionRate = discountRate === 0.05 ? 0.15 : 0.3;
  return {
    discountRate,
    adoptionRate,
    revenueLostBrl: roundTo(iptuRevenueBrl * discountRate, 2),
    privateInvestmentBrl: roundTo(estimatedInvestmentBrl * adoptionRate, 2),
    pvInstalledKwp: roundTo(solarPotentialKwp * adoptionRate, 1),
    annualGenerationMwh: roundTo(annualGenerationMwh * adoptionRate, 1),
    co2AvoidedTons: roundTo(annualCo2AvoidedTons * adoptionRate, 2),
  };
}

function assignTiers(
  neighbourhoods: Omit<SolarRegulationNeighbourhood, "tier">[]
): SolarRegulationNeighbourhood[] {
  const sorted = [...neighbourhoods].sort((a, b) => b.score - a.score);
  const total = sorted.length;

  if (total === 0) return [];

  const highCount = total === 1 ? 1 : Math.max(1, Math.floor(total / 3));
  const lowCount = total <= 2 ? total - highCount : Math.max(1, Math.floor(total / 3));

  return sorted.map((item, index) => {
    let tier: SolarRegulationTier = "medium";
    if (index < highCount) {
      tier = "high";
    } else if (index >= total - lowCount) {
      tier = "low";
    }

    return {
      ...item,
      tier,
    };
  });
}

function buildBuildings(
  features: any[],
  neighbourhoodNumbers: Set<string>
): SolarRegulationBuilding[] {
  const buildings: SolarRegulationBuilding[] = [];

  for (const feature of features) {
    const properties = feature?.properties || {};
    const neighbourhoodNumber = String(properties.neighbourhoodNumber || "").trim();
    if (!neighbourhoodNumber || !neighbourhoodNumbers.has(neighbourhoodNumber)) {
      continue;
    }

    const geometryCoords = feature?.geometry?.coordinates;
    const lng =
      asNumber(properties.matchedCenterLng) ??
      asNumber(properties.sourceLng) ??
      (Array.isArray(geometryCoords) ? asNumber(geometryCoords[0]) : null);
    const lat =
      asNumber(properties.matchedCenterLat) ??
      asNumber(properties.sourceLat) ??
      (Array.isArray(geometryCoords) ? asNumber(geometryCoords[1]) : null);

    if (lat === null || lng === null) continue;

    const panelCount = asNumber(properties.maxArrayPanelsCount);
    const panelCapacityWatts = asNumber(properties.panelCapacityWatts);
    const solarPotentialKwp =
      panelCount !== null && panelCapacityWatts !== null
        ? roundTo((panelCount * panelCapacityWatts) / 1000, 1)
        : null;

    const annualGenerationKwh = asNumber(properties.maxYearlyEnergyDcKwh);
    const investmentAmount = asNumber(properties?.estimatedInvestmentCost?.amount);

    buildings.push({
      id: String(properties.commercialBuildingId ?? buildings.length + 1),
      neighbourhoodNumber,
      neighbourhoodName: properties.neighbourhoodName || "Unknown",
      lat,
      lng,
      solarPotentialKwp,
      annualGenerationMwh:
        annualGenerationKwh !== null ? roundTo(annualGenerationKwh / 1000, 1) : null,
      investmentBrl: investmentAmount !== null ? roundTo(investmentAmount, 2) : null,
      imageryQuality:
        typeof properties.imageryQuality === "string"
          ? properties.imageryQuality
          : null,
    });
  }

  return buildings;
}

function sumInvestmentByNeighbourhood(
  buildings: SolarRegulationBuilding[]
): Map<string, number> {
  const investmentByNumber = new Map<string, number>();

  for (const building of buildings) {
    if (building.investmentBrl === null) continue;

    investmentByNumber.set(
      building.neighbourhoodNumber,
      roundTo(
        (investmentByNumber.get(building.neighbourhoodNumber) ?? 0) +
          building.investmentBrl,
        2
      )
    );
  }

  return investmentByNumber;
}

export async function loadSolarRegulationData(): Promise<SolarRegulationDataset> {
  const [solarNeighbourhoodsRaw, taxRaw, buildingsRaw] = await Promise.all([
    fetchJson<FeatureCollectionLike>(SOLAR_NEIGHBOURHOODS_PATH),
    fetchJson<FeatureCollectionLike>(COMMERCIAL_TAX_PATH),
    fetchJson<FeatureCollectionLike>(COMMERCIAL_BUILDINGS_PATH),
  ]);

  const solarFeatures = getFeatures(solarNeighbourhoodsRaw);
  const taxFeatures = mergeTaxFeatures(getFeatures(taxRaw));
  const buildingsFeatures = getFeatures(buildingsRaw);

  const taxByNumber = new Map(
    taxFeatures.map((feature) => [
      feature.properties.neighbourhood_number,
      feature,
    ])
  );

  const draftNeighbourhoods = solarFeatures
    .map((feature) => {
      const properties = feature?.properties || {};
      const number = String(properties.neighbourhood_number || "").trim();
      const tax = taxByNumber.get(number);
      if (!number || !tax) return null;

      const annualGenerationMwh = asNumber(properties.total_yearly_energy_dc_mwh) ?? 0;
      const annualGenerationKwh = asNumber(properties.total_yearly_energy_dc_kwh) ?? 0;
      const annualCo2AvoidedTons =
        asNumber(properties.total_estimated_co2_savings_tonnes_per_year) ?? 0;
      const solarPotentialKwp = annualGenerationKwh > 0 ? annualGenerationKwh / 1405 : 0;

      return {
        id: number,
        number,
        name: properties.neighbourhood_name || tax.properties.neighbourhood_name,
        score: 0,
        solarPotentialKwp: roundTo(solarPotentialKwp, 1),
        annualGenerationMwh: roundTo(annualGenerationMwh, 1),
        annualCo2AvoidedTons: roundTo(annualCo2AvoidedTons, 2),
        commercialBuildings:
          asNumber(properties.commercial_building_count) ??
          tax.properties.commercial_buildings_count,
        iptuRevenueBrl: roundTo(tax.properties.iptu_total_tax, 2),
        taxPerCommercialBuilding: tax.properties.tax_per_commercial_building,
        geometry: tax.geometry.coordinates.length > 1
          ? tax.geometry
          : ({
              type: "Polygon",
              coordinates: tax.geometry.coordinates[0],
            } as GeoJSON.Polygon),
      };
    })
    .filter((item): item is DraftSolarRegulationNeighbourhood => item !== null);

  const neighbourhoodNumbers = new Set(
    draftNeighbourhoods.map((neighbourhood) => neighbourhood.number)
  );
  const buildings = buildBuildings(buildingsFeatures, neighbourhoodNumbers);
  const investmentByNumber = sumInvestmentByNeighbourhood(buildings);

  const neighbourhoodsWithScenarios = draftNeighbourhoods.map((item) => {
    const estimatedInvestmentBrl = roundTo(investmentByNumber.get(item.number) ?? 0, 2);

    return {
      ...item,
      estimatedInvestmentBrl,
      scenario5: buildScenario(
        0.05,
        item.solarPotentialKwp,
        item.annualGenerationMwh,
        item.annualCo2AvoidedTons,
        item.iptuRevenueBrl,
        estimatedInvestmentBrl
      ),
      scenario10: buildScenario(
        0.1,
        item.solarPotentialKwp,
        item.annualGenerationMwh,
        item.annualCo2AvoidedTons,
        item.iptuRevenueBrl,
        estimatedInvestmentBrl
      ),
    };
  });

  const solarValues = neighbourhoodsWithScenarios.map((item) => item.solarPotentialKwp);
  const taxValues = neighbourhoodsWithScenarios.map((item) => item.iptuRevenueBrl);
  const minSolar = Math.min(...solarValues);
  const maxSolar = Math.max(...solarValues);
  const minTax = Math.min(...taxValues);
  const maxTax = Math.max(...taxValues);

  const scored = neighbourhoodsWithScenarios.map((item) => {
    const solarScore = normalize(item.solarPotentialKwp, minSolar, maxSolar);
    const taxScore = 1 - normalize(item.iptuRevenueBrl, minTax, maxTax);
    return {
      ...item,
      score: roundTo((solarScore * 0.5 + taxScore * 0.5) * 100, 1),
    };
  });

  const neighbourhoods = assignTiers(scored);

  return {
    neighbourhoods,
    buildings,
    coveredNeighbourhoodCount: neighbourhoods.length,
    totalTaxNeighbourhoodCount: taxFeatures.length,
  };
}

export function buildSolarRegulationCsv(
  neighbourhoods: SolarRegulationNeighbourhood[]
): string {
  const header = [
    "neighbourhood_name",
    "tier",
    "commercial_buildings",
    "solar_potential_kwp",
    "annual_generation_mwh",
    "iptu_revenue_brl",
    "estimated_investment_brl",
    "scenario_5_revenue_lost_brl",
    "scenario_5_private_investment_brl",
    "scenario_10_revenue_lost_brl",
    "scenario_10_private_investment_brl",
  ];

  const rows = neighbourhoods.map((item) => [
    item.name,
    item.tier,
    String(item.commercialBuildings),
    String(item.solarPotentialKwp),
    String(item.annualGenerationMwh),
    String(item.iptuRevenueBrl),
    String(item.estimatedInvestmentBrl),
    String(item.scenario5.revenueLostBrl),
    String(item.scenario5.privateInvestmentBrl),
    String(item.scenario10.revenueLostBrl),
    String(item.scenario10.privateInvestmentBrl),
  ]);

  return [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
}

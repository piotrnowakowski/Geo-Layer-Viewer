// Mock data for Solar PV Interventions

export interface MunicipalBuilding {
  id: string;
  name: string;
  type: "school" | "facility";
  lat: number;
  lng: number;
  score: number; // 0–100
  priorityTier: "high" | "medium" | "low";
  roofAreaM2: number;
  capacityKwp: number;
  annualGenerationMwh: number;
  capexBrl: number;
  annualSavingsBrl: number;
  paybackYears: number;
  co2AvoidedTonsPerYear: number;
  solarGhi: number; // kWh/m²/year
  floodRisk: "low" | "moderate" | "high";
  neighborhood: string;
}

export interface Neighborhood {
  id: string;
  name: string;
  tier: "high" | "medium" | "low";
  bounds: [number, number][]; // polygon coords for neighborhood boundary
  commercialBuildings: number;
  residentialBuildings: number;
  solarPotentialKwp: number; // total commercial solar potential
  iptuRevenueBrl: number; // annual IPTU from commercial buildings
  avgSolarGhi: number; // kWh/m²/year
  scenario5pct: {
    revenueLostBrl: number;
    pvInstalledKwp: number;
    annualGenerationMwh: number;
    co2AvoidedTons: number;
  };
  scenario10pct: {
    revenueLostBrl: number;
    pvInstalledKwp: number;
    annualGenerationMwh: number;
    co2AvoidedTons: number;
  };
}

export interface CommercialBuilding {
  id: string;
  neighborhoodId: string;
  lat: number;
  lng: number;
  type: "commercial";
  roofAreaM2: number;
  solarPotentialKwp: number;
}

export interface ResidentialBuilding {
  id: string;
  neighborhoodId: string;
  lat: number;
  lng: number;
  type: "residential";
}

// Porto Alegre neighborhoods center coordinates
const NEIGHBORHOODS = {
  "Centro Histórico": { lat: -30.0277, lng: -51.2315 },
  "Moinhos de Vento": { lat: -30.0155, lng: -51.1975 },
  "Cidade Baixa": { lat: -30.0455, lng: -51.2155 },
  "Bom Fim": { lat: -30.0055, lng: -51.2255 },
  Petrópolis: { lat: -30.0355, lng: -51.2055 },
  "Menino Deus": { lat: -30.0755, lng: -51.2355 },
  Floresta: { lat: -30.0655, lng: -51.2455 },
  Auxiliadora: { lat: -30.0955, lng: -51.2155 },
  Santana: { lat: -30.1155, lng: -51.2555 },
  Partenon: { lat: -30.1355, lng: -51.2755 },
};

// Helper to generate random point within radius
function randomPointInRadius(center: [number, number], radiusKm: number): [number, number] {
  const radiusDegrees = radiusKm / 111; // rough conversion
  const angle = Math.random() * 2 * Math.PI;
  const radius = Math.random() * radiusDegrees;
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle),
  ];
}

// Helper to generate neighborhood boundary polygon
function generateNeighborhoodBounds(center: [number, number], radiusKm: number): [number, number][] {
  const radiusDegrees = radiusKm / 111;
  const points: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * 2 * Math.PI;
    points.push([
      center[0] + radiusDegrees * Math.cos(angle),
      center[1] + radiusDegrees * Math.sin(angle),
    ]);
  }
  points.push(points[0]); // close polygon
  return points;
}

// Generate municipal buildings data
export function generateMunicipalBuildings(): MunicipalBuilding[] {
  const buildings: MunicipalBuilding[] = [];
  let id = 1;

  const neighborhoodNames = Object.keys(NEIGHBORHOODS) as (keyof typeof NEIGHBORHOODS)[];
  
  neighborhoodNames.forEach((neighborhood) => {
    const center = NEIGHBORHOODS[neighborhood];
    // 56 buildings total (560 simplified for mock)
    const buildingsPerNeighborhood = 5;

    for (let i = 0; i < buildingsPerNeighborhood; i++) {
      const isSchool = Math.random() > 0.5;
      const [lat, lng] = randomPointInRadius([center.lat, center.lng], 1);
      const score = Math.floor(Math.random() * 100);
      const priorityTier = score > 70 ? "high" : score > 40 ? "medium" : "low";
      const roofAreaM2 = isSchool ? 1500 + Math.random() * 2000 : 800 + Math.random() * 1200;
      const capacityKwp = isSchool ? 30 + Math.random() * 50 : 100 + Math.random() * 200;
      const annualGenerationMwh = (capacityKwp * 1405) / 1000; // 1405 kWh/kWp/year
      const capexBrl = capacityKwp * 4500; // R$4,500/kWp
      const annualSavingsBrl = annualGenerationMwh * 180 * 1000; // R$180/MWh savings
      const paybackYears = capexBrl / annualSavingsBrl;
      const co2AvoidedTonsPerYear = annualGenerationMwh * 0.183; // 0.183 tCO2/MWh
      const solarGhi = 1500 + Math.random() * 200; // 1,500–1,700 kWh/m²/yr

      buildings.push({
        id: `bldg_${id}`,
        name: `${isSchool ? "EMEF" : "Prédio"} ${neighborhood} ${i + 1}`,
        type: isSchool ? "school" : "facility",
        lat,
        lng,
        score,
        priorityTier,
        roofAreaM2,
        capacityKwp,
        annualGenerationMwh,
        capexBrl,
        annualSavingsBrl,
        paybackYears,
        co2AvoidedTonsPerYear,
        solarGhi,
        floodRisk: Math.random() > 0.7 ? "high" : Math.random() > 0.5 ? "moderate" : "low",
        neighborhood,
      });
      id++;
    }
  });

  return buildings;
}

// Generate neighborhoods data
export function generateNeighborhoods(): Neighborhood[] {
  const neighborhoods: Neighborhood[] = [];
  const neighborhoodNames = Object.keys(NEIGHBORHOODS) as (keyof typeof NEIGHBORHOODS)[];

  // Assign tiers: 3 high, 4 medium, 3 low
  const tierAssignment: Record<string, "high" | "medium" | "low"> = {};
  const highCount = 3;
  const mediumCount = 4;

  neighborhoodNames.slice(0, highCount).forEach((name) => {
    tierAssignment[name] = "high";
  });
  neighborhoodNames.slice(highCount, highCount + mediumCount).forEach((name) => {
    tierAssignment[name] = "medium";
  });
  neighborhoodNames.slice(highCount + mediumCount).forEach((name) => {
    tierAssignment[name] = "low";
  });

  neighborhoodNames.forEach((name) => {
    const center = NEIGHBORHOODS[name];
    const centerArray: [number, number] = [center.lat, center.lng];
    const tier = tierAssignment[name];

    const commercialCount = 5 + Math.floor(Math.random() * 10);
    const residentialCount = 10 + Math.floor(Math.random() * 20);
    const solarPotentialKwp = commercialCount * (30 + Math.random() * 70);
    const iptuRevenueBrl = solarPotentialKwp * 5000 + Math.random() * 100000; // R$5,000/kWp as proxy

    // Scenario calculations
    const avg5pctAdoptionRate = 0.15;
    const avg10pctAdoptionRate = 0.30;
    const avgSystemSize = 50; // kWp

    neighborhoods.push({
      id: `nbh_${name.replace(/\s+/g, "_").toLowerCase()}`,
      name,
      tier,
      bounds: generateNeighborhoodBounds(centerArray, 1.5),
      commercialBuildings: commercialCount,
      residentialBuildings: residentialCount,
      solarPotentialKwp,
      iptuRevenueBrl,
      avgSolarGhi: 1550 + Math.random() * 150,
      scenario5pct: {
        revenueLostBrl: iptuRevenueBrl * 0.05,
        pvInstalledKwp: commercialCount * avgSystemSize * avg5pctAdoptionRate,
        annualGenerationMwh:
          (commercialCount * avgSystemSize * avg5pctAdoptionRate * 1405) / 1000,
        co2AvoidedTons:
          (commercialCount * avgSystemSize * avg5pctAdoptionRate * 1405 * 0.183) /
          1000,
      },
      scenario10pct: {
        revenueLostBrl: iptuRevenueBrl * 0.10,
        pvInstalledKwp: commercialCount * avgSystemSize * avg10pctAdoptionRate,
        annualGenerationMwh:
          (commercialCount * avgSystemSize * avg10pctAdoptionRate * 1405) / 1000,
        co2AvoidedTons:
          (commercialCount * avgSystemSize * avg10pctAdoptionRate * 1405 * 0.183) /
          1000,
      },
    });
  });

  return neighborhoods;
}

// Generate commercial buildings
export function generateCommercialBuildings(neighborhoods: Neighborhood[]): CommercialBuilding[] {
  const buildings: CommercialBuilding[] = [];
  let id = 1;

  neighborhoods.forEach((nbh) => {
    const center = NEIGHBORHOODS[nbh.name as keyof typeof NEIGHBORHOODS];
    if (!center) return;

    for (let i = 0; i < nbh.commercialBuildings; i++) {
      const [lat, lng] = randomPointInRadius([center.lat, center.lng], 1.2);
      buildings.push({
        id: `commercial_${id}`,
        neighborhoodId: nbh.id,
        lat,
        lng,
        type: "commercial",
        roofAreaM2: 800 + Math.random() * 1200,
        solarPotentialKwp: 30 + Math.random() * 70,
      });
      id++;
    }
  });

  return buildings;
}

// Generate residential buildings
export function generateResidentialBuildings(neighborhoods: Neighborhood[]): ResidentialBuilding[] {
  const buildings: ResidentialBuilding[] = [];
  let id = 1;

  neighborhoods.forEach((nbh) => {
    const center = NEIGHBORHOODS[nbh.name as keyof typeof NEIGHBORHOODS];
    if (!center) return;

    for (let i = 0; i < nbh.residentialBuildings; i++) {
      const [lat, lng] = randomPointInRadius([center.lat, center.lng], 1.2);
      buildings.push({
        id: `residential_${id}`,
        neighborhoodId: nbh.id,
        lat,
        lng,
        type: "residential",
      });
      id++;
    }
  });

  return buildings;
}

// Reference projects data
export const REFERENCE_PROJECTS = [
  {
    id: 1,
    city: "Salvador, BA",
    program: "IPTU Verde",
    summary:
      "Since 2015, property tax discounts up to 10% for buildings with sustainability features including solar. Over 500 commercial properties enrolled. Key learning: adoption accelerated when combined with simplified permitting.",
    url: "https://www.salvador.ba.gov.br",
  },
  {
    id: 2,
    city: "Guarulhos, SP",
    program: "IPTU Verde",
    summary:
      "Offers 5–20% IPTU discount for green buildings. Commercial uptake higher than residential due to faster payback. Key learning: larger buildings (>500m²) adopt at 3× rate of smaller ones.",
    url: "https://www.guarulhos.sp.gov.br",
  },
  {
    id: 3,
    city: "Recife, PE",
    program: "IPTU Sustentável",
    summary:
      "5–10% discount program launched 2020. Focus on commercial and mixed-use. Key learning: pairing with low-interest BNDES financing doubled adoption.",
    url: "https://www.recife.pe.gov.br",
  },
  {
    id: 4,
    city: "Belo Horizonte, MG",
    program: "IPTU Verde",
    summary:
      "Property tax incentive linked to sustainability certification. Key learning: clear technical guidelines for PV installation reduced application processing time by 60%.",
    url: "https://www.belo-horizonte.mg.gov.br",
  },
];

import fs from "fs";
import path from "path";

export interface BuildingsData {
  layerId: string;
  label: string;
  featureCount: number;
  geoJson: any;
}

export interface IPTUNeighbourhoodsData {
  layerId: string;
  label: string;
  featureCount: number;
  geoJson: any;
}

const BUILDINGS_CONFIG = {
  layerId: "obm-buildings",
  label: "OBM Buildings (Porto Alegre)",
  dataFile: path.join(process.cwd(), "data/building_type/obm_porto_alegre_buildings_known.geojson"),
};

const BUILDINGS_COMMERCIAL_CONFIG = {
  layerId: "obm-buildings-commercial",
  label: "OBM Commercial Buildings (Porto Alegre)",
  dataFile: path.join(process.cwd(), "data/building_type/obm_porto_alegre_buildings_commercial.geojson"),
};

// Color palette for building types
const BUILDING_TYPE_COLORS: Record<string, string> = {
  "Residential (single-family)": "#FF6B6B",      // Red
  "Multi-family residential": "#FF8C42",          // Orange
  "Commercial": "#4ECDC4",                        // Teal
  "Industrial": "#95A5A6",                        // Gray
  "Government": "#3498DB",                        // Blue
  "Education": "#E74C3C",                         // Dark Red
  "Assembly": "#9B59B6",                          // Purple
  "Mixed-use": "#F1C40F",                         // Yellow
  "Agricultural": "#27AE60",                      // Green
};

let cachedData: BuildingsData | null = null;

export async function getBuildingsData(): Promise<BuildingsData> {
  // Return cached data if available
  if (cachedData) {
    return cachedData;
  }

  try {
    // Load GeoJSON file
    const fileContent = fs.readFileSync(BUILDINGS_CONFIG.dataFile, "utf-8");
    const geoJson = JSON.parse(fileContent);

    if (!geoJson.features || !Array.isArray(geoJson.features)) {
      throw new Error("Invalid GeoJSON: no features array found");
    }

    console.log(`Loaded ${geoJson.features.length} building features`);

    // Add color property to each feature based on building type
    geoJson.features.forEach((feature: any) => {
      if (feature.properties) {
        const buildingType = feature.properties.building_type || "Unknown";
        feature.properties.color = BUILDING_TYPE_COLORS[buildingType] || "#cccccc";
      }
    });

    cachedData = {
      layerId: BUILDINGS_CONFIG.layerId,
      label: BUILDINGS_CONFIG.label,
      featureCount: geoJson.features.length,
      geoJson,
    };

    console.log(`Buildings data cached: ${cachedData.featureCount} features`);
    return cachedData;
  } catch (error: any) {
    console.error("Failed to load buildings data:", error);
    throw new Error(`Failed to load buildings data: ${error.message}`);
  }
}

let cachedCommercialData: BuildingsData | null = null;

export async function getCommercialBuildingsData(): Promise<BuildingsData> {
  // Return cached data if available
  if (cachedCommercialData) {
    return cachedCommercialData;
  }

  try {
    // Load GeoJSON file
    const fileContent = fs.readFileSync(BUILDINGS_COMMERCIAL_CONFIG.dataFile, "utf-8");
    const geoJson = JSON.parse(fileContent);

    if (!geoJson.features || !Array.isArray(geoJson.features)) {
      throw new Error("Invalid GeoJSON: no features array found");
    }

    console.log(`Loaded ${geoJson.features.length} commercial building features`);

    // Add color property to each feature based on building type
    geoJson.features.forEach((feature: any) => {
      if (feature.properties) {
        const buildingType = feature.properties.building_type || "Unknown";
        feature.properties.color = BUILDING_TYPE_COLORS[buildingType] || "#cccccc";
      }
    });

    cachedCommercialData = {
      layerId: BUILDINGS_COMMERCIAL_CONFIG.layerId,
      label: BUILDINGS_COMMERCIAL_CONFIG.label,
      featureCount: geoJson.features.length,
      geoJson,
    };

    console.log(`Commercial buildings data cached: ${cachedCommercialData.featureCount} features`);
    return cachedCommercialData;
  } catch (error: any) {
    console.error("Failed to load commercial buildings data:", error);
    throw new Error(`Failed to load commercial buildings data: ${error.message}`);
  }
}

export function getBuildingTypeColors(): Record<string, string> {
  return BUILDING_TYPE_COLORS;
}

let cachedIPTUData: IPTUNeighbourhoodsData | null = null;

export async function getIPTUNeighbourhoodsData(): Promise<IPTUNeighbourhoodsData> {
  // Return cached data if available
  if (cachedIPTUData) {
    return cachedIPTUData;
  }

  try {
    // Load GeoJSON file from Geo-Layer-Viewer data directory
    const dataFilePath = path.join(process.cwd(), "data/iptu/poa_iptu_neighbourhoods.geojson");
    const fileContent = fs.readFileSync(dataFilePath, "utf-8");
    const geoJson = JSON.parse(fileContent);

    if (!geoJson.features || !Array.isArray(geoJson.features)) {
      throw new Error("Invalid GeoJSON: no features array found");
    }

    console.log(`Loaded ${geoJson.features.length} IPTU neighbourhood features`);

    cachedIPTUData = {
      layerId: "iptu-neighbourhoods",
      label: "IPTU by Neighbourhood",
      featureCount: geoJson.features.length,
      geoJson,
    };

    console.log(`IPTU neighbourhoods data cached: ${cachedIPTUData.featureCount} features`);
    return cachedIPTUData;
  } catch (error: any) {
    console.error("Failed to load IPTU neighbourhoods data:", error);
    throw new Error(`Failed to load IPTU neighbourhoods data: ${error.message}`);
  }
}

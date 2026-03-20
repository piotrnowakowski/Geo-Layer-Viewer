import {
  buildMunicipalBuildingsSolarLayerData,
  isMunicipalBuildingsSolarLayerId,
  MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID,
} from "@/data/municipal-buildings-solar";

const sampleDataCache = new Map<string, any>();

const MUNICIPAL_BUILDINGS_GEOCODED_API_PATH = "/api/geospatial/municipal-buildings";
const MUNICIPAL_BUILDINGS_SOLAR_API_PATH = "/api/geospatial/municipal-solar";
const MUNICIPAL_BUILDINGS_SOLAR_SAMPLE_PATH =
  "/sample-data/porto-alegre-google-solar-municipal-buildings.json";

async function loadMunicipalBuildingsSolarData(): Promise<any> {
  const cacheKey = MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID;
  if (sampleDataCache.has(cacheKey)) return sampleDataCache.get(cacheKey);

  let solarSource: any = null;
  try {
    solarSource = await loadFromApi(
      MUNICIPAL_BUILDINGS_SOLAR_API_PATH,
      "municipal_buildings_solar_source"
    );
  } catch {
    solarSource = await loadSampleData(MUNICIPAL_BUILDINGS_SOLAR_SAMPLE_PATH);
  }
  if (solarSource) {
    sampleDataCache.set("municipal_buildings_solar_source", solarSource);
  }

  if (solarSource?.source === "municipal-buildings-solar" && solarSource?.geoJson?.features) {
    const layerData = buildMunicipalBuildingsSolarLayerData(null, solarSource);
    sampleDataCache.set(cacheKey, layerData);
    return layerData;
  }

  let geocodedSource = sampleDataCache.get("municipal_buildings_geocoded_source");
  if (!geocodedSource) {
    try {
      geocodedSource = await loadFromApi(
        MUNICIPAL_BUILDINGS_GEOCODED_API_PATH,
        "municipal_buildings_geocoded_source"
      );
    } catch {
      geocodedSource = null;
    }
  }

  if (!solarSource && !geocodedSource) return null;

  const layerData = buildMunicipalBuildingsSolarLayerData(
    geocodedSource,
    solarSource
  );
  sampleDataCache.set(cacheKey, layerData);
  return layerData;
}

async function loadFromApi(apiPath: string, cacheKey: string): Promise<any> {
  if (sampleDataCache.has(cacheKey)) return sampleDataCache.get(cacheKey);

  const response = await fetch(apiPath);
  if (!response.ok) throw new Error(`Failed to load ${apiPath}: ${response.status}`);
  const data = await response.json();
  sampleDataCache.set(cacheKey, data);
  return data;
}

async function loadSampleData(path: string): Promise<any> {
  if (sampleDataCache.has(path)) return sampleDataCache.get(path);

  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return null;
    const data = await response.json();
    sampleDataCache.set(path, data);
    return data;
  } catch {
    return null;
  }
}

export async function loadBoundaryData(): Promise<any> {
  let data = await loadSampleData("/sample-data/porto-alegre-boundary.json");
  if (!data) {
    data = await loadFromApi("/api/geospatial/boundary", "boundary");
  }
  return data;
}

export async function loadLayerData(layerId: string): Promise<any> {
  if (isMunicipalBuildingsSolarLayerId(layerId)) {
    return loadMunicipalBuildingsSolarData();
  }

  const samplePaths: Record<string, string> = {
    rivers: "/sample-data/porto-alegre-rivers.json",
    grid_flood: "/sample-data/porto-alegre-grid.json",
    grid_heat: "/sample-data/porto-alegre-grid.json",
    grid_landslide: "/sample-data/porto-alegre-grid.json",
    transit_stops: "/sample-data/porto-alegre-transit-stops.json",
    transit_routes: "/sample-data/porto-alegre-transit-routes.json",
    solar_potential: "/sample-data/porto-alegre-solar-neighbourhoods.json",
    commercial_solar_neighbourhoods:
      "/sample-data/porto-alegre-google-solar-commercial-neighbourhoods.current.json",
    ibge_census: "/sample-data/porto-alegre-ibge-indicators.json",
    ibge_settlements: "/sample-data/porto-alegre-ibge-settlements.json",
    sites_parks:      "/sample-data/porto-alegre-sites-parks.json",
    sites_schools:    "/sample-data/porto-alegre-sites-schools.json",
    sites_hospitals:  "/sample-data/porto-alegre-sites-hospitals.json",
    sites_wetlands:   "/sample-data/porto-alegre-sites-wetlands.json",
    sites_sports:     "/sample-data/porto-alegre-sites-sports.json",
    sites_social:     "/sample-data/porto-alegre-sites-social.json",
    sites_vacant:       "/sample-data/porto-alegre-sites-vacant.json",
    sites_flood_zones:  "/sample-data/porto-alegre-sites-flood_zones.json",
    sites_flood2024:    "/sample-data/porto-alegre-flood-2024.json",
    power_infrastructure: "/sample-data/porto-alegre-mapbiomas-power-infrastructure.json",
    "obm-buildings":    "/sample-data/porto-alegre-buildings-commercial.json",
    "iptu-neighbourhoods": "/sample-data/poa-iptu-neighbourhoods.json",
  };

  const apiPaths: Record<string, string> = {
    rivers: "/api/geospatial/rivers",
    grid_flood: "/api/geospatial/grid",
    grid_heat: "/api/geospatial/grid",
    grid_landslide: "/api/geospatial/grid",
    transit_stops: "/api/geospatial/transit-stops",
    transit_routes: "/api/geospatial/transit-routes",
    solar_potential: "/api/geospatial/solar-neighbourhoods",
    ibge_census: "/api/geospatial/ibge-indicators",
    ibge_settlements: "/api/geospatial/ibge-settlements",
    sites_parks:     "/api/geospatial/sites/sites_parks",
    sites_schools:   "/api/geospatial/sites/sites_schools",
    sites_hospitals: "/api/geospatial/sites/sites_hospitals",
    sites_wetlands:  "/api/geospatial/sites/sites_wetlands",
    sites_sports:    "/api/geospatial/sites/sites_sports",
    sites_social:    "/api/geospatial/sites/sites_social",
    sites_vacant:      "/api/geospatial/sites/sites_vacant",
    sites_flood_zones: "/api/geospatial/sites/sites_flood_zones",
    power_infrastructure: "/api/geospatial/mapbiomas-power-infrastructure",
    "obm-buildings":   "/api/geospatial/buildings/commercial",
    "iptu-neighbourhoods": "/api/geospatial/iptu-neighbourhoods",
  };

  const samplePath = samplePaths[layerId];
  if (samplePath) {
    let data = await loadSampleData(samplePath);
    if (data) return data;
  }

  const apiPath = apiPaths[layerId];
  if (apiPath) {
    try {
      return await loadFromApi(apiPath, layerId);
    } catch {
      return null;
    }
  }

  return null;
}

export function clearCache(): void {
  sampleDataCache.clear();
}

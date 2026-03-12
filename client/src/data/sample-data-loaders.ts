const sampleDataCache = new Map<string, any>();

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
  const samplePaths: Record<string, string> = {
    elevation: "/sample-data/porto-alegre-elevation.json",
    landcover: "/sample-data/porto-alegre-landcover.json",
    surface_water: "/sample-data/porto-alegre-surface-water.json",
    rivers: "/sample-data/porto-alegre-rivers.json",
    forest: "/sample-data/porto-alegre-forest.json",
    grid_flood: "/sample-data/porto-alegre-grid.json",
    grid_heat: "/sample-data/porto-alegre-grid.json",
    grid_landslide: "/sample-data/porto-alegre-grid.json",
    grid_population: "/sample-data/porto-alegre-grid.json",
    grid_buildings: "/sample-data/porto-alegre-grid.json",
    transit_stops: "/sample-data/porto-alegre-transit-stops.json",
    transit_routes: "/sample-data/porto-alegre-transit-routes.json",
    solar_potential: "/sample-data/porto-alegre-solar-neighbourhoods.json",
    ibge_census: "/sample-data/porto-alegre-ibge-indicators.json",
    ibge_settlements: "/sample-data/porto-alegre-ibge-settlements.json",
  };

  const apiPaths: Record<string, string> = {
    elevation: "/api/geospatial/elevation",
    landcover: "/api/geospatial/landcover",
    surface_water: "/api/geospatial/surface-water",
    rivers: "/api/geospatial/rivers",
    forest: "/api/geospatial/forest",
    grid_flood: "/api/geospatial/grid",
    grid_heat: "/api/geospatial/grid",
    grid_landslide: "/api/geospatial/grid",
    grid_population: "/api/geospatial/grid",
    grid_buildings: "/api/geospatial/grid",
    transit_stops: "/api/geospatial/transit-stops",
    transit_routes: "/api/geospatial/transit-routes",
    solar_potential: "/api/geospatial/solar-neighbourhoods",
    ibge_census: "/api/geospatial/ibge-indicators",
    ibge_settlements: "/api/geospatial/ibge-settlements",
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

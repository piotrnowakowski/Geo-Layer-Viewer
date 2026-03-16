import type { Express } from "express";
import { createServer, type Server } from "http";
import { getCityBoundary } from "./services/osmService";
import { getRiversData } from "./services/riversService";
import { getSurfaceWaterData } from "./services/surfaceWaterService";
import { getForestCanopyData } from "./services/forestService";
import { getLandcoverData } from "./services/worldcoverService";
import { getBuildingData } from "./services/buildingService";
import { getPopulationData } from "./services/worldpopService";
import { getElevationData, computeElevationMetrics } from "./services/copernicusService";
import { fetchSiteLayer, SITE_LAYER_CONFIGS } from "./services/osmSitesService";
import { getFlood2024Data } from "./services/flood2024Service";
import { getElderlyPopulationData } from "./services/elderlyService";
import {
  generateGrid,
  computeRiverMetrics,
  computeWaterMetrics,
  computeLandcoverMetrics,
  computeBuildingMetrics,
  computePopulationMetrics,
  computeFlowAccumulation,
  computeCompositeScores,
} from "./services/gridService";
import type { GeoBounds } from "@shared/schema";
import fs from "fs";
import path from "path";

interface TileLayerConfig {
  urlTemplate: string;
  maxNativeZoom?: number;
}

const OEF_TILE_LAYERS: Record<string, TileLayerConfig> = {
  // ── OEF geospatial-data catalog tile layers ────────────────────────────────
  dynamic_world: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/dynamic_world/release/v1/2023/porto_alegre/tiles_visual/{z}/{x}/{y}.png",
  },
  solar_pvout: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/global_solar_atlas/release/v2/tiles_pvout/{z}/{x}/{y}.png",
  },
  jrc_surface_water: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/jrc_global_surface_water/release/v1/porto_alegre/transition/tiles_visual/{z}/{x}/{y}.png",
  },
  ghsl_built_up: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/ghsl_built_up/release/v1/2025/porto_alegre/tiles_visual/{z}/{x}/{y}.png",
  },
  ghsl_urbanization: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/ghsl_degree_urbanization/release/v2/2024/porto_alegre/tiles_visual/{z}/{x}/{y}.png",
  },
  hansen_forest_loss: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/hansen_forest_change/release/v1/2024/porto_alegre/loss/tiles_visual/{z}/{x}/{y}.png",
  },
  ghsl_population: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/ghsl_population/release/v1/2025/porto_alegre/tiles_visual/{z}/{x}/{y}.png",
  },
  viirs_nightlights: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/noaa_viirs_nightlights/release/v1/2024/tiles_visual/{z}/{x}/{y}.png",
  },
  copernicus_emsn194: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/copernicus_emsn194/release/v1/2024/porto_alegre/tiles_visual/{z}/{x}/{y}.png",
  },
  modis_ndvi: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/modis_ndvi/release/v1/2024/tiles_visual/{z}/{x}/{y}.png",
  },
  merit_hydro_hand: {
    urlTemplate:
      "https://geo-test-api.s3.us-east-1.amazonaws.com/merit_hydro/release/v1/porto_alegre/hnd/tiles_visual/{z}/{x}/{y}.png",
  },
  // ── Hydrology & Terrain ───────────────────────────────────────────────────
  copernicus_dem_visual: {
    urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/copernicus_dem/release/v1/2024/porto_alegre/tiles_visual/{z}/{x}/{y}.png",
  },
  merit_elv: {
    urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/merit_hydro/release/v1/porto_alegre/elv/tiles_visual/{z}/{x}/{y}.png",
  },
  merit_upa: {
    urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/merit_hydro/release/v1/porto_alegre/upa/tiles_visual/{z}/{x}/{y}.png",
  },
  jrc_occurrence: {
    urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/jrc_global_surface_water/release/v1/porto_alegre/occurrence/tiles_visual/{z}/{x}/{y}.png",
  },
  jrc_seasonality: {
    urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/jrc_global_surface_water/release/v1/porto_alegre/seasonality/tiles_visual/{z}/{x}/{y}.png",
  },
  hansen_treecover2000: {
    urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/hansen_forest_change/release/v1/2024/porto_alegre/tree_cover_2000/tiles_visual/{z}/{x}/{y}.png",
  },
  // ── CHIRPS extreme precipitation indices ──────────────────────────────────
  chirps_r90p_2024:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/r90p/tiles_visual/{z}/{x}/{y}.png" },
  chirps_r90p_clim:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/r90p/tiles_visual/{z}/{x}/{y}.png" },
  chirps_r95p_2024:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/r95p/tiles_visual/{z}/{x}/{y}.png" },
  chirps_r95p_clim:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/r95p/tiles_visual/{z}/{x}/{y}.png" },
  chirps_r99p_2024:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/r99p/tiles_visual/{z}/{x}/{y}.png" },
  chirps_r99p_clim:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/r99p/tiles_visual/{z}/{x}/{y}.png" },
  chirps_rx1day_2024: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/rx1day/tiles_visual/{z}/{x}/{y}.png" },
  chirps_rx1day_clim: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/rx1day/tiles_visual/{z}/{x}/{y}.png" },
  chirps_rx5day_2024: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/rx5day/tiles_visual/{z}/{x}/{y}.png" },
  chirps_rx5day_clim: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/rx5day/tiles_visual/{z}/{x}/{y}.png" },
  // ── ERA5-Land extreme temperature indices ─────────────────────────────────
  era5_tnx_2024:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_temperature/era5/land_daily_aggregated/2024/tnx/tiles_visual/{z}/{x}/{y}.png" },
  era5_tnx_clim:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_temperature/era5/land_daily_aggregated/annual_climatology/tnx/tiles_visual/{z}/{x}/{y}.png" },
  era5_tx90p_2024: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_temperature/era5/land_daily_aggregated/2024/tx90p/tiles_visual/{z}/{x}/{y}.png" },
  era5_tx90p_clim: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_temperature/era5/land_daily_aggregated/annual_climatology/tx90p/tiles_visual/{z}/{x}/{y}.png" },
  era5_tx99p_2024: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_temperature/era5/land_daily_aggregated/2024/tx99p/tiles_visual/{z}/{x}/{y}.png" },
  era5_tx99p_clim: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_temperature/era5/land_daily_aggregated/annual_climatology/tx99p/tiles_visual/{z}/{x}/{y}.png" },
  era5_txx_2024:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_temperature/era5/land_daily_aggregated/2024/txx/tiles_visual/{z}/{x}/{y}.png" },
  era5_txx_clim:   { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/extreme_temperature/era5/land_daily_aggregated/annual_climatology/txx/tiles_visual/{z}/{x}/{y}.png" },
  // ── Heatwave Magnitude Index (observed + projections) ─────────────────────
  hwm_2024:      { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/2024/tiles_visual/{z}/{x}/{y}.png" },
  hwm_clim:      { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/annual_climatology/tiles_visual/{z}/{x}/{y}.png" },
  hwm_2030s_245: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/2030s_ssp245/tiles_visual/{z}/{x}/{y}.png" },
  hwm_2030s_585: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/2030s_ssp585/tiles_visual/{z}/{x}/{y}.png" },
  hwm_2050s_585: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/2050s_ssp245/tiles_visual/{z}/{x}/{y}.png" },
  hwm_2100s_585: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/2100s_ssp585/tiles_visual/{z}/{x}/{y}.png" },
  // ── Flood Risk Index (observed + projections) ─────────────────────────────
  fri_2024:      { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2024/tiles_visual/{z}/{x}/{y}.png" },
  fri_2030s_245: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2030s_ssp245/tiles_visual/{z}/{x}/{y}.png" },
  fri_2030s_585: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2030s_ssp585/tiles_visual/{z}/{x}/{y}.png" },
  fri_2050s_245: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2050s_ssp245/tiles_visual/{z}/{x}/{y}.png" },
  fri_2050s_585: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2050s_ssp585/tiles_visual/{z}/{x}/{y}.png" },
  fri_2100s_245: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2100s_ssp245/tiles_visual/{z}/{x}/{y}.png" },
  fri_2100s_585: { urlTemplate: "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2100s_ssp585/tiles_visual/{z}/{x}/{y}.png" },
  // ── NASA GIBS: VIIRS SNPP Brightness Temp Band I5 (Day), 375m ─────────────
  // GIBS uses {z}/{y}/{x} (WMTS TileRow before TileCol), serves up to zoom 9.
  // Date: 2022-01-15 = southern-hemisphere summer peak heat in Porto Alegre.
  viirs_i5_day: {
    urlTemplate:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Brightness_Temp_BandI5_Day/default/2022-01-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
    maxNativeZoom: 9,
  },
};

const S3_GEOJSON_URLS: Record<string, string> = {
  "transit-stops": "https://geo-test-api.s3.us-east-1.amazonaws.com/poa-gtfs/release/2024-10-01/stops.geojson",
  "transit-routes": "https://geo-test-api.s3.us-east-1.amazonaws.com/poa-gtfs/release/2024-10-01/shapes.geojson",
  "solar-neighbourhoods": "https://geo-test-api.s3.us-east-1.amazonaws.com/global_solar_atlas/release/v2/poa_solar_neighbourhoods.geojson",
  "ibge-indicators": "https://geo-test-api.s3.us-east-1.amazonaws.com/br_ibge/release/2010/porto_alegre/porto_alegre_indicators.geojson",
  "ibge-settlements": "https://geo-test-api.s3.us-east-1.amazonaws.com/br_ibge/release/2024/porto_alegre/poa_informal_settlements.geojson",
};

const S3_CACHE_FILES: Record<string, string> = {
  "transit-stops": "porto-alegre-transit-stops.json",
  "transit-routes": "porto-alegre-transit-routes.json",
  "solar-neighbourhoods": "porto-alegre-solar-neighbourhoods.json",
  "ibge-indicators": "porto-alegre-ibge-indicators.json",
  "ibge-settlements": "porto-alegre-ibge-settlements.json",
};

function getSampleDataPath(filename: string): string {
  return path.resolve(process.cwd(), "client", "public", "sample-data", filename);
}

function saveSampleData(filename: string, data: any): void {
  const dirPath = path.resolve(process.cwd(), "client", "public", "sample-data");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(getSampleDataPath(filename), JSON.stringify(data));
}

function loadCachedData(filename: string): any | null {
  const filePath = getSampleDataPath(filename);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

function getBoundsFromBoundary(boundary: any): GeoBounds {
  return {
    minLat: boundary.bbox[0],
    minLng: boundary.bbox[1],
    maxLat: boundary.bbox[2],
    maxLng: boundary.bbox[3],
  };
}

function buildGrid(bounds: GeoBounds): any {
  const grid = generateGrid(bounds, 1);

  const rivers = loadCachedData("porto-alegre-rivers.json");
  if (rivers?.geoJson) computeRiverMetrics(grid, rivers.geoJson);

  const water = loadCachedData("porto-alegre-surface-water.json");
  if (water?.geoJson) computeWaterMetrics(grid, water.geoJson);

  const landcover = loadCachedData("porto-alegre-landcover.json");
  if (landcover?.geoJson) computeLandcoverMetrics(grid, landcover.geoJson);

  const buildings = loadCachedData("porto-alegre-buildings.json");
  if (buildings) computeBuildingMetrics(grid, buildings);

  const population = loadCachedData("porto-alegre-population.json");
  if (population) computePopulationMetrics(grid, population);

  const elevation = loadCachedData("porto-alegre-elevation.json");
  if (elevation) {
    computeElevationMetrics(grid, elevation, bounds);
    computeFlowAccumulation(grid, elevation);
  }

  computeCompositeScores(grid);

  return grid;
}

async function fetchAndCacheS3GeoJSON(datasetKey: string): Promise<any> {
  const cacheFile = S3_CACHE_FILES[datasetKey];
  if (cacheFile) {
    const cached = loadCachedData(cacheFile);
    if (cached) return cached;
  }

  const url = S3_GEOJSON_URLS[datasetKey];
  if (!url) throw new Error(`Unknown dataset: ${datasetKey}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`S3 fetch failed for ${datasetKey}: ${response.status}`);
  }

  const data = await response.json();

  if (cacheFile) {
    saveSampleData(cacheFile, data);
  }

  return data;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/geospatial/tiles/:layerId/:z/:x/:y.png", async (req, res) => {
    const { layerId } = req.params;
    let { z, x, y } = req.params;

    if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
      return res.status(400).json({ message: "Invalid tile coordinates" });
    }

    const config = OEF_TILE_LAYERS[layerId];
    if (!config) {
      return res.status(404).json({ message: `Layer "${layerId}" not available` });
    }

    // Server-side zoom clamping: if the layer has a maxNativeZoom and the
    // requested zoom exceeds it, compute the equivalent tile at maxNativeZoom.
    // This handles clients that send high-zoom requests despite the Leaflet option.
    if (config.maxNativeZoom !== undefined) {
      const reqZ = parseInt(z);
      if (reqZ > config.maxNativeZoom) {
        const diff = reqZ - config.maxNativeZoom;
        const scale = Math.pow(2, diff);
        z = String(config.maxNativeZoom);
        x = String(Math.floor(parseInt(x) / scale));
        y = String(Math.floor(parseInt(y) / scale));
      }
    }

    const tileUrl = config.urlTemplate
      .replace("{z}", z)
      .replace("{x}", x)
      .replace("{y}", y);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const tileResponse = await fetch(tileUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!tileResponse.ok) {
        if (tileResponse.status === 404 || tileResponse.status === 403) {
          res.set("Cache-Control", "public, max-age=3600");
          return res.status(204).end();
        }
        return res
          .status(502)
          .json({ message: `Upstream error: ${tileResponse.status}` });
      }

      const buffer = Buffer.from(await tileResponse.arrayBuffer());
      const upstreamContentType = tileResponse.headers.get("content-type") || "image/png";
      res.set({
        "Content-Type": upstreamContentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      });
      res.send(buffer);
    } catch (error: any) {
      if (error.name === "AbortError") {
        return res.status(504).json({ message: "Tile request timed out" });
      }
      return res.status(502).json({ message: "Failed to fetch tile" });
    }
  });

  app.get("/api/geospatial/transit-stops", async (_req, res) => {
    try {
      const data = await fetchAndCacheS3GeoJSON("transit-stops");
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/transit-routes", async (_req, res) => {
    try {
      const data = await fetchAndCacheS3GeoJSON("transit-routes");
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/solar-neighbourhoods", async (_req, res) => {
    try {
      const data = await fetchAndCacheS3GeoJSON("solar-neighbourhoods");
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/ibge-indicators", async (_req, res) => {
    try {
      const data = await fetchAndCacheS3GeoJSON("ibge-indicators");
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/ibge-settlements", async (_req, res) => {
    try {
      const data = await fetchAndCacheS3GeoJSON("ibge-settlements");
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/elevation", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-elevation.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getElevationData(bounds);
      saveSampleData("porto-alegre-elevation.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/boundary", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-boundary.json");
      if (cached) return res.json(cached);

      const data = await getCityBoundary("Porto Alegre", "BR-POA");
      saveSampleData("porto-alegre-boundary.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/rivers", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-rivers.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getRiversData("BR-POA", bounds);
      saveSampleData("porto-alegre-rivers.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/surface-water", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-surface-water.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getSurfaceWaterData("BR-POA", bounds);
      saveSampleData("porto-alegre-surface-water.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/forest", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-forest.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getForestCanopyData("BR-POA", bounds);
      saveSampleData("porto-alegre-forest.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/landcover", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-landcover.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getLandcoverData("BR-POA", bounds);
      saveSampleData("porto-alegre-landcover.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/buildings", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-buildings.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getBuildingData("BR-POA", bounds);
      saveSampleData("porto-alegre-buildings.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/population", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-population.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getPopulationData(bounds);
      saveSampleData("porto-alegre-population.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/flood-2024", async (_req, res) => {
    const cacheFile = "porto-alegre-flood-2024.json";
    try {
      const cached = loadCachedData(cacheFile);
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getFlood2024Data(bounds);
      saveSampleData(cacheFile, data);
      res.json(data);
    } catch (error: any) {
      res.status(503).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/social-vulnerability", async (_req, res) => {
    const cacheFile = "porto-alegre-social-vuln.json";
    try {
      const cached = loadCachedData(cacheFile);
      if (cached) return res.json(cached);

      // Build social vulnerability index from the real IBGE neighbourhood indicators
      // (already cached from /api/geospatial/ibge-indicators).
      // Uses: poverty_rate, pct_low_income (income Q1+Q2 households), pop_density_km2.
      const ibgeData = loadCachedData("porto-alegre-ibge-indicators.json");
      if (!ibgeData?.features?.length) {
        return res.status(400).json({ message: "IBGE indicators not loaded — call /api/geospatial/ibge-indicators first" });
      }

      const features = ibgeData.features as any[];

      // Compute min/max for normalisation
      const getVal = (p: any) => {
        const poverty = p.poverty_rate || 0;
        const lowInc  = p.pct_low_income || 0;
        return (poverty + lowInc) / 2;
      };
      const vals = features.map((f: any) => getVal(f.properties));
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;

      const enriched = features.map((f: any) => {
        const p = f.properties || {};
        const raw = getVal(p);
        const vuln_index = (raw - minV) / range; // 0 = least vulnerable, 1 = most
        return {
          ...f,
          properties: {
            ...p,
            vuln_index,
            vuln_pct: raw,
            poverty_rate: p.poverty_rate || 0,
            pct_low_income: p.pct_low_income || 0,
            data_source: "ibge_censo_2022",
          },
        };
      });

      const result = {
        source: "ibge_censo_2022_neighbourhood_indicators",
        featureCount: enriched.length,
        geoJson: { type: "FeatureCollection", features: enriched },
      };
      saveSampleData(cacheFile, result);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/sites/:layerId", async (req, res) => {
    const { layerId } = req.params;
    const config = SITE_LAYER_CONFIGS.find((c) => c.layerId === layerId);
    if (!config) return res.status(404).json({ message: `Unknown site layer: ${layerId}` });

    const cacheFile = `porto-alegre-sites-${layerId.replace("sites_", "")}.json`;
    try {
      const cached = loadCachedData(cacheFile);
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await fetchSiteLayer(layerId, bounds);
      saveSampleData(cacheFile, data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/grid", async (_req, res) => {
    try {
      const hasBuildings = !!loadCachedData("porto-alegre-buildings.json");
      const hasElevation = !!loadCachedData("porto-alegre-elevation.json");
      const hasPopulation = !!loadCachedData("porto-alegre-population.json");
      const allDeps = hasBuildings && hasElevation && hasPopulation;

      const cached = loadCachedData("porto-alegre-grid.json");
      if (cached && allDeps) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const grid = buildGrid(bounds);

      const data = {
        totalCells: grid.features.length,
        cellSizeMeters: 1000,
        geoJson: grid,
      };

      if (allDeps) {
        saveSampleData("porto-alegre-grid.json", data);
      }
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}

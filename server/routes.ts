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
import { getBuildingsData, getBuildingTypeColors, getCommercialBuildingsData, getIPTUNeighbourhoodsData } from "./services/buildingsDataService";
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
import {
  sampleAtPoints,
  listRasterDatasets,
  preloadRasterDatasets,
} from "./services/cogSamplerService";
import { buildMunicipalBuildingsSolarLayerData } from "../client/src/data/municipal-buildings-solar";
import {
  loadLayer,
  listVectorLayers,
  pointsInLayer,
  intersectLines,
} from "./services/spatialAnalysisService";
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
  "mapbiomas-power-infrastructure": "https://geo-test-api.s3.us-east-1.amazonaws.com/mapbiomass_energy_infra/energy_infrastructure.geojson",
  "iptu-neighbourhoods": "https://geo-test-api.s3.us-east-1.amazonaws.com/br_ibge/release/2010/porto_alegre/poa_iptu_neighbourhoods.geojson",
  "municipal-solar": "https://geo-test-api.s3.us-east-1.amazonaws.com/poa-data/porto-alegre-google-solar-municipal-buildings.json",
  "commercial-solar": "https://geo-test-api.s3.us-east-1.amazonaws.com/poa-data/porto-alegre-google-solar-commercial-buildings.json",
};

const S3_CACHE_FILES: Record<string, string> = {
  "transit-stops": "porto-alegre-transit-stops.json",
  "transit-routes": "porto-alegre-transit-routes.json",
  "solar-neighbourhoods": "porto-alegre-solar-neighbourhoods.json",
  "ibge-indicators": "porto-alegre-ibge-indicators.json",
  "ibge-settlements": "porto-alegre-ibge-settlements.json",
  "mapbiomas-power-infrastructure": "porto-alegre-mapbiomas-power-infrastructure.json",
  "iptu-neighbourhoods": "poa-iptu-neighbourhoods.json",
  "municipal-solar": "porto-alegre-google-solar-municipal-buildings.json",
  "commercial-solar": "porto-alegre-google-solar-commercial-buildings.json",
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

function loadMunicipalBuildingsGeoJson(): any {
  const filePath = path.resolve(
    process.cwd(),
    "pv_panel_data",
    "Municipal_buildings.geocoded.json"
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(
      "Municipal buildings geocoded file not found at pv_panel_data/Municipal_buildings.geocoded.json"
    );
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const records = Array.isArray(raw?.records) ? raw.records : [];

  const features = records.flatMap((record: any) => {
    const latitude = record?.location?.latitude;
    const longitude = record?.location?.longitude;

    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude)
    ) {
      return [];
    }

    return [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        properties: {
          municipalBuildingId: record?.item ?? null,
          utilizedBy: typeof record?.utilizedBy === "string" ? record.utilizedBy : null,
          sourceStreet: record?.address?.street ?? null,
          sourceNumber: record?.address?.number ?? null,
          sourceNeighborhood: record?.address?.neighborhood ?? null,
          sourceCity: record?.address?.city ?? null,
          sourceState: record?.address?.state ?? null,
          sourceCountry: record?.address?.country ?? null,
          sourceAddress: record?.address?.formatted ?? null,
          locationPrecision: record?.location?.precision ?? null,
          locationSource: record?.location?.source ?? null,
          matchStatus: record?.match?.status ?? null,
          matchQueryUsed: record?.match?.queryUsed ?? null,
          matchedAddress: record?.match?.matchedAddress ?? null,
          matchedPostalCode: record?.match?.postalCode ?? null,
          matchProvider: record?.match?.provider ?? null,
          matchScore:
            typeof record?.match?.score === "number" &&
            Number.isFinite(record.match.score)
              ? record.match.score
              : null,
          matchAddrType: record?.match?.addrType ?? null,
          matchDistrict: record?.match?.district ?? null,
        },
      },
    ];
  });

  return {
    source: "municipal-buildings-geocoded",
    inputFile: "pv_panel_data/Municipal_buildings.geocoded.json",
    generatedAt: raw?.metadata?.generatedAt ?? null,
    geocoder: raw?.metadata?.geocoder ?? null,
    totalRows:
      typeof raw?.metadata?.totalRows === "number"
        ? raw.metadata.totalRows
        : records.length,
    matchedRows:
      typeof raw?.metadata?.matchedRows === "number"
        ? raw.metadata.matchedRows
        : features.length,
    unmatchedRows:
      typeof raw?.metadata?.unmatchedRows === "number"
        ? raw.metadata.unmatchedRows
        : 0,
    geoJson: {
      type: "FeatureCollection",
      features,
    },
  };
}

async function loadMunicipalSolarLayerData(): Promise<any> {
  const geocodedSource = loadMunicipalBuildingsGeoJson();
  let solarSource: any = null;

  try {
    solarSource = await fetchAndCacheS3GeoJSON("municipal-solar");
  } catch (error) {
    console.warn(
      `[municipal-solar] Falling back to geocoded-only municipal registry: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return buildMunicipalBuildingsSolarLayerData(geocodedSource, solarSource);
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

// ── Coordinate extraction helper ──────────────────────────────────────────
function flattenCoords(geom: any): number[][] {
  if (!geom) return [];
  switch (geom.type) {
    case "Point":
      return [geom.coordinates];
    case "LineString":
    case "MultiPoint":
      return geom.coordinates;
    case "Polygon":
    case "MultiLineString":
      return geom.coordinates.flat(1);
    case "MultiPolygon":
      return geom.coordinates.flat(2);
    case "GeometryCollection":
      return geom.geometries.flatMap(flattenCoords);
    default:
      return [];
  }
}

async function registerCachedRoute(
  app: Express,
  routePath: string,
  cacheKey: string,
  loader: (bounds: GeoBounds) => Promise<any>,
  statusOnErr = 500
) {
  app.get(routePath, async (_req, res) => {
    try {
      const cached = loadCachedData(cacheKey);
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await loader(bounds);
      saveSampleData(cacheKey, data);
      res.json(data);
    } catch (error: any) {
      res.status(statusOnErr).json({ message: error.message });
    }
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Kick off background raster pre-loading so the first user request is fast
  preloadRasterDatasets();

  // Register OEF tile layers
  Object.entries(OEF_TILE_LAYERS).forEach(([layerId, config]) => {
    app.get(`/api/geospatial/tiles/${layerId}/:z/:x/:y.png`, async (req, res) => {
      let { z, x, y } = req.params;

      if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
        return res.status(400).json({ message: "Invalid tile coordinates" });
      }

      // Server-side zoom clamping
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

  app.get("/api/geospatial/municipal-buildings", (_req, res) => {
    try {
      const data = loadMunicipalBuildingsGeoJson();
      res.json(data);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
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

  app.get("/api/geospatial/mapbiomas-power-infrastructure", async (_req, res) => {
    try {
      const data = await fetchAndCacheS3GeoJSON("mapbiomas-power-infrastructure");
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/iptu-neighbourhoods", async (_req, res) => {
    try {
      const data = await getIPTUNeighbourhoodsData();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/municipal-solar", async (_req, res) => {
    try {
      const data = await loadMunicipalSolarLayerData();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/commercial-solar", async (_req, res) => {
    try {
      const data = await fetchAndCacheS3GeoJSON("commercial-solar");
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  registerCachedRoute(app, "/api/geospatial/elevation", "porto-alegre-elevation.json", (b) => getElevationData(b));

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

  registerCachedRoute(app, "/api/geospatial/rivers", "porto-alegre-rivers.json", (b) => getRiversData("BR-POA", b));
  registerCachedRoute(app, "/api/geospatial/surface-water", "porto-alegre-surface-water.json", (b) => getSurfaceWaterData("BR-POA", b));
  registerCachedRoute(app, "/api/geospatial/forest", "porto-alegre-forest.json", (b) => getForestCanopyData("BR-POA", b));
  registerCachedRoute(app, "/api/geospatial/landcover", "porto-alegre-landcover.json", (b) => getLandcoverData("BR-POA", b));
  registerCachedRoute(app, "/api/geospatial/buildings", "porto-alegre-buildings.json", (b) => getBuildingData("BR-POA", b));
  registerCachedRoute(app, "/api/geospatial/population", "porto-alegre-population.json", (b) => getPopulationData(b));
  registerCachedRoute(app, "/api/geospatial/flood-2024", "porto-alegre-flood-2024.json", (b) => getFlood2024Data(b), 503);

  app.get("/api/geospatial/social-vulnerability", async (_req, res) => {
    const cacheFile = "porto-alegre-social-vuln.json";
    try {
      const cached = loadCachedData(cacheFile);
      if (cached) return res.json(cached);

      const ibgeData = loadCachedData("porto-alegre-ibge-indicators.json");
      if (!ibgeData?.features?.length) {
        return res.status(400).json({ message: "IBGE indicators not loaded — call /api/geospatial/ibge-indicators first" });
      }

      const features = ibgeData.features as any[];
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
        const vuln_index = (raw - minV) / range;
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

  app.get("/api/geospatial/buildings", async (_req, res) => {
    try {
      const data = await getBuildingsData();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/buildings/commercial", async (_req, res) => {
    try {
      const data = await getCommercialBuildingsData();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/building-colors", async (_req, res) => {
    try {
      const colors = getBuildingTypeColors();
      res.json(colors);
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

  app.get("/api/analyze/datasets", (_req, res) => {
    res.json({
      raster: listRasterDatasets(),
      vector: listVectorLayers(),
    });
  });

  app.post("/api/analyze/raster", async (req, res) => {
    try {
      const { datasetId, features } = req.body as {
        datasetId: string;
        features: { type: string; features: any[] };
      };
      if (!datasetId || !features?.features) {
        return res.status(400).json({ message: "datasetId and features are required" });
      }

      const points = features.features.map((f: any) => {
        const geom = f.geometry;
        if (!geom) return { lng: 0, lat: 0 };
        if (geom.type === "Point") {
          return { lng: geom.coordinates[0] as number, lat: geom.coordinates[1] as number };
        }
        const coords = flattenCoords(geom);
        if (coords.length === 0) return { lng: 0, lat: 0 };
        const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
        const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
        return { lng, lat };
      });

      const values = await sampleAtPoints(datasetId, points);
      const enriched = features.features.map((f: any, i: number) => ({
        ...f,
        properties: { ...(f.properties ?? {}), [datasetId]: values[i] },
      }));

      res.json({
        type: "FeatureCollection",
        features: enriched,
        _meta: {
          datasetId,
          sampled: values.filter((v) => v !== null).length,
          total: enriched.length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/analyze/vector", async (req, res) => {
    try {
      const { operation, layerA, layerB, options = {} } = req.body as {
        operation: string;
        layerA: string;
        layerB: string;
        options?: {
          bufferMeters?: number;
          scoreField?: string;
          scoreThreshold?: number;
        };
      };

      if (!operation || !layerA || !layerB) {
        return res.status(400).json({ message: "operation, layerA, and layerB are required" });
      }

      const fcA = loadLayer(layerA);
      const fcB = loadLayer(layerB);

      let result;
      if (operation === "points_in_layer") {
        result = pointsInLayer(fcA, fcB, options);
      } else if (operation === "intersect_lines") {
        result = intersectLines(fcA, fcB, options);
      } else {
        return res
          .status(400)
          .json({ message: `Unknown operation "${operation}". Valid: points_in_layer, intersect_lines` });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/geospatial/proxy-tile", async (req, res) => {
    const { url } = req.query as { url?: string };
    const ALLOWED_HOST = "https://geo-test-api.s3.us-east-1.amazonaws.com/";
    if (!url || !url.startsWith(ALLOWED_HOST)) {
      return res.status(400).json({ error: "URL must be from the OEF S3 bucket" });
    }
    try {
      const upstream = await fetch(url);
      if (!upstream.ok) return res.status(upstream.status).end();
      const buf = await upstream.arrayBuffer();
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=3600");
      res.set("Access-Control-Allow-Origin", "*");
      res.end(Buffer.from(buf));
    } catch (err: any) {
      res.status(502).json({ error: err.message });
    }
  });

  return httpServer;
}

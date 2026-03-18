import { Link } from "wouter";
import { ArrowLeft, ExternalLink, FlaskConical, CheckCircle2 } from "lucide-react";
import { LAYER_CONFIGS, LAYER_GROUPS, LAYER_SECTIONS, type LayerConfig } from "@/data/layer-configs";

interface LayerDataInfo {
  id: string;
  methodology: string;
  source: string;
  sourceUrl?: string;
  date: string;
  resolution: string;
  coverage: string;
  notes?: string;
}

// ── Raw-data access instructions by layer group ──────────────────────────────
const ACCESS_GEE =
  "These tiles are pre-rendered PNGs — pixel values are display colours, not raw data values. " +
  "To use this dataset in numerical calculations, access it via Google Earth Engine (GEE): open " +
  "code.earthengine.google.com, search the Data Catalog for the dataset name or the GEE asset ID " +
  "shown in the source link, and run server-side analysis (JavaScript or Python earthengine-api). " +
  "Export results to GeoTIFF via ee.Image.export() for use in GDAL, rasterio, or xarray pipelines.";

const ACCESS_CHIRPS =
  "These tiles are pre-rendered PNGs — pixel values are display colours, not raw precipitation values. " +
  "Raw daily grids are available via Google Earth Engine (dataset: UCSB-CHG/CHIRPS/DAILY) or the " +
  "CHIRPS FTP server (ftp://ftp.chc.ucsb.edu/pub/org/chg/products/CHIRPS-2.0/). " +
  "Index computation (R90p, R95p, R99p, RX1day, RX5day) requires: (1) deriving per-pixel percentile " +
  "thresholds from the 1981–2010 baseline time series, (2) applying thresholds to the target year. " +
  "Recommended Python stack: xarray, numpy, cftime. No API key required.";

const ACCESS_ERA5 =
  "These tiles are pre-rendered PNGs — pixel values are display colours, not raw temperature values. " +
  "Raw ERA5-Land fields are available via the Copernicus Climate Data Store API " +
  "(pip install cdsapi; register at cds.climate.copernicus.eu). Request dataset " +
  "'reanalysis-era5-land', variable '2m_temperature', as NetCDF. " +
  "ETCCDI index definitions (TNx, TXx, TX90p, TX99p) are documented at climdex.org. " +
  "Recommended Python stack: xarray, cf_index, rioxarray. Free with CDS account.";

const ACCESS_OEF_COMPUTED =
  "These tiles are pre-rendered PNGs of OEF-computed indices — pixel values are display colours, " +
  "not raw index values. Source GeoTIFF rasters are available via the OEF geospatial-data repository " +
  "(github.com/Open-Earth-Foundation/geospatial-data) or on request from the OEF data team. " +
  "Inputs for independent replication: CHIRPS v2.0 (precipitation, via GEE: UCSB-CHG/CHIRPS/DAILY) " +
  "and Copernicus DEM GLO-30 (terrain, via AWS: registry.opendata.aws/copernicus-dem) for FRI; " +
  "ERA5-Land daily temperature + CMIP6 downscaled projections for HWM. " +
  "Python stack: xarray, rioxarray, scipy, intake-esm.";

const ACCESS_COPERNICUS_DEM =
  "These tiles are pre-rendered PNGs — pixel values are display colours, not elevation metres. " +
  "Raw GeoTIFF data is freely available from AWS Open Data Registry without authentication " +
  "(registry.opendata.aws/copernicus-dem). Download specific tiles by lat/lon bounding box " +
  "using 'aws s3 cp --no-sign-request', then mosaic with gdalwarp. " +
  "Also accessible server-side via Google Earth Engine (asset: COPERNICUS/DEM/GLO30).";

function getRawDataAccess(layerId: string): string {
  if (layerId.startsWith("oef_chirps_")) return ACCESS_CHIRPS;
  if (layerId.startsWith("oef_era5_")) return ACCESS_ERA5;
  if (layerId === "oef_hwm_2024" || layerId === "oef_hwm_clim") return ACCESS_ERA5;
  if (layerId.startsWith("oef_hwm_") || layerId.startsWith("oef_fri_")) return ACCESS_OEF_COMPUTED;
  if (layerId === "oef_copernicus_dem") return ACCESS_COPERNICUS_DEM;
  return ACCESS_GEE;
}

// Returns a short description of what numerical values are accessible in-tool for layers
// where hasValueTiles is true. Used to populate the green "Values Available" box.
function getInToolValueDescription(layer: LayerConfig): string {
  const enc = layer.valueEncoding;

  // Postprocessing (spatial query) layers — raster value sampled and attached to each feature
  if (layer.id === "post_settlements_flood") {
    return "Flood Risk Index (0–1) decoded from the OEF FRI 2024 raster at each settlement centroid " +
      "and attached to the feature. Hover any highlighted polygon to read the exact FRI value. " +
      "Only settlements with FRI > 0.4 are shown.";
  }
  if (layer.id === "post_bus_heatwave") {
    return "Heatwave Magnitude (°C·days) decoded from the OEF HWM 2024 raster at each route midpoint " +
      "and attached to the feature. Hover any route to read the exact HWM value. " +
      "Only routes with HWM ≥ 10 °C·days are shown.";
  }

  // Tile layers with value tiles
  if (layer.source === "tiles" && enc) {
    if (enc.type === "categorical") {
      const classNames = enc.classes ? Object.values(enc.classes).join(", ") : "land cover classes";
      return `Categorical pixel values decoded in-tool. Hover the map to read the land cover class at any point. ` +
        `Available classes: ${classNames}.`;
    }
    if (enc.type === "numeric" && enc.unit) {
      return `Pixel values decoded to real numbers (${enc.unit}) using the OEF value tile formula ` +
        `value = (R + 256·G + 65536·B + ${enc.offset ?? 0}) / ${enc.scale ?? 100}. ` +
        `Hover the map to read the exact value at any point in the tooltip.`;
    }
  }

  // GeoJSON layers with quantitative properties
  if (layer.id === "solar_potential") {
    return "Real values available as GeoJSON feature properties: PVOUT_mean (kWh/kWp/day), " +
      "GHI_mean (kWh/m²/year), DNI_mean. Hover any neighbourhood polygon to see the values. " +
      "Raw data also available via the Global Solar Atlas API.";
  }
  if (layer.id === "ibge_census") {
    return "Real values available as GeoJSON feature properties: poverty_rate (0–1), population_total, " +
      "pct_low_income, pct_high_income, pct_piped_water, pct_formal_sewage, pop_density_km² " +
      "Hover any neighbourhood polygon to see all indicators.";
  }

  // Generic GeoJSON vector layers (geometry + properties are the data)
  return "Vector geometry and feature properties are directly accessible. Hover any feature to " +
    "see its properties in the tooltip. The underlying GeoJSON is served from the API at /api/geospatial/ " +
    "and can be fetched programmatically for use in spatial analysis.";
}

const LAYER_DATA_INFO: LayerDataInfo[] = [
  {
    id: "rivers",
    methodology: "River and stream line features extracted from OpenStreetMap via Overpass API using [waterway=river/stream/canal/drain] tags within the city bounding box.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://wiki.openstreetmap.org/wiki/Key:waterway",
    date: "2024 (continuously updated)",
    resolution: "Vector LineString geometries at full OSM detail",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Includes major rivers (Rio Gravataí, Arroio Dilúvio) and minor streams/canals. River proximity is a key input to flood risk scoring.",
  },
  {
    id: "solar_potential",
    methodology: "Solar photovoltaic output potential aggregated to neighbourhood level. Mean PVOUT (kWh/kWp/day) computed from the Global Solar Atlas v2 raster for each Porto Alegre neighbourhood polygon. GHI (Global Horizontal Irradiation) and DNI (Direct Normal Irradiation) yearly means are also included.",
    source: "Global Solar Atlas — World Bank / Solargis",
    sourceUrl: "https://globalsolaratlas.info/",
    date: "Long-term average (1994-2018)",
    resolution: "Source: 250m raster; aggregated to neighbourhood polygons",
    coverage: "99 Porto Alegre neighbourhoods",
    notes: "PVOUT represents the specific yield of a grid-connected PV system with optimally tilted modules. Typical range in Porto Alegre: 3.8-4.3 kWh/kWp/day.",
  },
  {
    id: "transit_stops",
    methodology: "Public transit stop locations extracted from the official GTFS (General Transit Feed Specification) dataset published by EPTC (Empresa Publica de Transporte e Circulacao), the Porto Alegre municipal transit authority. Each stop includes geographic coordinates, stop name, and stop code.",
    source: "EPTC Porto Alegre — GTFS Static Feed",
    sourceUrl: "https://www.eptc.com.br/",
    date: "October 2024 release",
    resolution: "Individual stop point locations",
    coverage: "5,909 bus stops across Porto Alegre municipality",
    notes: "Licensed under CC BY 4.0. Data represents the complete urban bus network of Porto Alegre.",
  },
  {
    id: "transit_routes",
    methodology: "Bus route geometries (shapes) extracted from the official GTFS dataset published by EPTC. Each shape represents the geographic path followed by a bus line, stored as a LineString geometry.",
    source: "EPTC Porto Alegre — GTFS Static Feed",
    sourceUrl: "https://www.eptc.com.br/",
    date: "October 2024 release",
    resolution: "Vector LineString geometries at GTFS shape point resolution",
    coverage: "762 route shapes across Porto Alegre municipality",
    notes: "Licensed under CC BY 4.0. Shapes represent the spatial paths of bus routes; schedule/frequency data is not included in this layer.",
  },
  {
    id: "ibge_census",
    methodology: "Socioeconomic indicators aggregated to neighbourhood level from the Brazilian Census 2010 (IBGE). Includes total population, poverty rate (fraction of households below poverty line), income distribution quintiles (pct_low_income, pct_high_income), infrastructure access (pct_piped_water, pct_formal_sewage), and population density per km\u00b2.",
    source: "IBGE — Brazilian Institute of Geography and Statistics",
    sourceUrl: "https://www.ibge.gov.br/",
    date: "Census 2010 (latest full census with neighbourhood-level socioeconomic data)",
    resolution: "Neighbourhood polygons (setor censitario aggregated)",
    coverage: "99 Porto Alegre neighbourhoods",
    notes: "Licensed under CC BY 4.0. Poverty rate ranges from 0 to 1. The 2022 census microdata for Porto Alegre neighbourhoods is pending release by IBGE.",
  },
  {
    id: "ibge_settlements",
    methodology: "Informal settlement (aglomerado subnormal) boundaries identified by IBGE through satellite imagery interpretation and field verification. Each polygon represents a cluster of housing units characterized by irregular land tenure, absence of formal property titles, and/or deficient urban infrastructure.",
    source: "IBGE — Brazilian Institute of Geography and Statistics",
    sourceUrl: "https://www.ibge.gov.br/",
    date: "2022 Census preliminary boundaries (released 2024)",
    resolution: "Vector polygon boundaries at census tract resolution",
    coverage: "125 informal settlement polygons across Porto Alegre",
    notes: "Licensed under CC BY 4.0. Informal settlements are areas of particular social vulnerability and are important for targeting nature-based interventions that improve resilience.",
  },
  {
    id: "oef_dynamic_world",
    methodology: "Land use classification tiles from Google Dynamic World, a near-real-time 10m land use/land cover dataset derived from Sentinel-2 imagery. Pre-rendered visual tiles served from OEF S3 bucket.",
    source: "Google Dynamic World via OpenEarth Foundation",
    sourceUrl: "https://dynamicworld.app/",
    date: "2023 composite",
    resolution: "10 meters per pixel",
    coverage: "Porto Alegre metropolitan area",
    notes: "9-class land cover: water, trees, grass, flooded vegetation, crops, shrub/scrub, built area, bare ground, snow/ice. Tiles pre-generated for web map display.",
  },
  {
    id: "oef_solar_tiles",
    methodology: "Pre-rendered solar photovoltaic output potential tiles from the Global Solar Atlas v2. Pixel values represent PVOUT (kWh/kWp/day) encoded as visual colour tiles for web map overlay.",
    source: "Global Solar Atlas v2 — World Bank / Solargis via OpenEarth Foundation",
    sourceUrl: "https://globalsolaratlas.info/",
    date: "Long-term average (1994-2018)",
    resolution: "250 meters per pixel",
    coverage: "Porto Alegre metropolitan area",
    notes: "Visual tile layer showing spatial variation in solar energy potential. For neighbourhood-level statistics, use the Solar Potential vector layer.",
  },
  {
    id: "oef_jrc_surface_water",
    methodology: "Surface water transition classes derived from the JRC Global Surface Water v1.4 dataset, which tracks surface water presence in over 3 million km² of Landsat imagery from 1984 to 2021. The 'transition' band classifies each pixel as: no change (0), permanent water (1), new permanent water (2), lost permanent water (3), seasonal water (4), new seasonal (5), lost seasonal (6), seasonal-to-permanent change (7), permanent-to-seasonal change (8), ephemeral permanent (9), or ephemeral seasonal (10). Pre-rendered tiles served from OEF S3 bucket.",
    source: "JRC Global Surface Water v1.4 — Joint Research Centre (EC) via Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater",
    date: "Landsat 1984–2021 composite; tiles generated 2024",
    resolution: "30 metres per pixel (Landsat native)",
    coverage: "Porto Alegre municipality",
    notes: "Useful for identifying areas where water extent has expanded (e.g. wetland recovery) or contracted (e.g. urban drainage). Permanent water gain/loss is particularly relevant to flood retention and NbS opportunity mapping. Licensed CC BY 4.0.",
  },
  {
    id: "oef_ghsl_built_up",
    methodology: "Built-up surface area in m² per 100 m grid cell from the GHSL Built-Up Surface Grid (GHS-BUILT-S), produced under the Global Human Settlement Layer programme (P2023A release). Derived from Sentinel-2 (10 m) and Landsat (30 m) imagery using a supervised classifier trained on OpenStreetMap and Copernicus reference data. Pre-rendered visual tiles hosted on OEF S3.",
    source: "GHSL GHS-BUILT-S P2023A — JRC (Joint Research Centre, EC) via Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/JRC_GHSL_P2023A_GHS_BUILT_S",
    date: "2025 reference epoch (P2023A)",
    resolution: "100 metres per pixel",
    coverage: "Porto Alegre municipality",
    notes: "Built-up surface area (m²) per cell is a key input to the GHSL population disaggregation model and exposure scoring. High values indicate dense urban fabric; near-zero values indicate green or open land suitable for NbS. Licensed CC BY 4.0.",
  },
  {
    id: "oef_ghsl_urbanization",
    methodology: "Degree of Urbanisation (SMOD) from the GHSL Settlement Model Grid (GHS-SMOD v2), implementing the Eurostat / UN Degree of Urbanisation methodology. Combines GHSL population grid and built-up grid at 1 km resolution to assign each cell to one of eight settlement classes ranging from water bodies and very-low-density rural areas through suburban clusters to urban centres. Pre-rendered tiles on OEF S3.",
    source: "GHSL GHS-SMOD v2.0 P2023A — JRC via Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/JRC_GHSL_P2023A_GHS_SMOD_V2-0",
    date: "2024 reference epoch (P2023A)",
    resolution: "1 kilometre per pixel",
    coverage: "Porto Alegre municipality",
    notes: "Settlement classes: Water (10), Very-low-density rural (11), Low-density rural (12), Rural cluster (13), Suburban/peri-urban (21), Semi-dense urban cluster (22), Dense urban cluster (23), Urban centre (30). Useful for identifying where urban heat island and impervious surface interventions are most impactful. Licensed CC BY 4.0.",
  },
  {
    id: "oef_hansen_forest",
    methodology: "Forest loss (stand-replacement disturbance) from 2000 to 2024, derived from the Hansen Global Forest Change dataset v1.12 (University of Maryland / Google). Based on annual Landsat time-series analysis. The loss band is binary: 0 = no loss detected, 1 = stand-replacement disturbance (year of loss encoded separately in the lossyear band). Tiles show cumulative loss 2000–2024. Pre-rendered visual tiles on OEF S3.",
    source: "Hansen Global Forest Change v1.12 — UMD / Google via Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2024_v1_12",
    date: "Cumulative 2000–2024 (Landsat annual composite)",
    resolution: "30 metres per pixel",
    coverage: "Porto Alegre municipality",
    notes: "Forest loss highlights areas where canopy cover was removed — critical for landslide risk (bare slopes) and urban heat (reduced cooling). Restoration of these areas is a primary NbS intervention target. Licensed CC BY 4.0.",
  },
  {
    id: "oef_ghsl_population",
    methodology: "Population count (inhabitants) per 100 m grid cell from the GHSL Population Grid (GHS-POP P2023A). Disaggregates census-based population estimates using the built-up surface layer as a proxy for where people live. UN-adjusted to match official national population totals. Pre-rendered visual tiles on OEF S3.",
    source: "GHSL GHS-POP P2023A — JRC via Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/JRC_GHSL_P2023A_GHS_POP",
    date: "2025 reference epoch (P2023A), based on census harmonisation",
    resolution: "100 metres per pixel",
    coverage: "Porto Alegre municipality",
    notes: "Higher spatial resolution than WorldPop (100 m vs 100 m, but different disaggregation methodology). Useful for exposure scoring and identifying densely populated cells within flood/heat hazard zones. Licensed CC BY 4.0.",
  },
  {
    id: "oef_viirs_nightlights",
    methodology: "Annual mean nighttime radiance from the NOAA/VIIRS Day/Night Band (DNB) stray-light corrected monthly composites (VCMSLCFG product). Radiance unit: nanoWatts/cm²/steradian. Annual composite computed as the mean of available monthly composites for 2024, cloud-masked using the cloud-free coverage band (cf_cvg). Values are a proxy for electrification density, economic activity, and human presence at night. Pre-rendered visual tiles on OEF S3.",
    source: "NOAA VIIRS DNB Monthly VCMSLCFG v1 — NOAA via Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/NOAA_VIIRS_DNB_MONTHLY_V1_VCMSLCFG",
    date: "Annual mean 2024 (monthly composites averaged)",
    resolution: "500 metres per pixel (VIIRS DNB native)",
    coverage: "Porto Alegre municipality",
    notes: "Night lights are a well-established proxy for informal settlement density and electricity access — both relevant to social vulnerability scoring. Anomalously dark areas within the urban core may indicate informal settlements with limited grid access. Public domain (no restrictions).",
  },
  {
    id: "oef_emsn194",
    methodology: "Maximum inundation water depth (in metres) derived from the Copernicus Emergency Management Service Risk and Recovery Mapping activation EMSN194, activated for the May 2024 Porto Alegre / Rio Grande do Sul flood event. The water depth raster was produced by hydraulic modelling and satellite-based flood delineation over the Porto Alegre area of interest (AOI). Pre-rendered as visual tiles on OEF S3. Value encoding: terrain-RGB (R×65536 + G×256 + B) × 0.01 metres.",
    source: "Copernicus EMS Risk and Recovery Mapping — EMSN194 (May 2024 RS floods)",
    sourceUrl: "https://mapping.emergency.copernicus.eu/activations/EMSN194/",
    date: "May 2024 flood event — maximum depth over the event period",
    resolution: "30 metres per pixel",
    coverage: "Porto Alegre AOI — Guaíba watershed / municipality",
    notes: "This layer shows the depth of inundation, not just presence/absence (unlike the Planet/SkySat flood extent layer). Depth information is critical for NbS sizing — e.g. retention basins must be designed for peak-depth volumes. Licensed under the Copernicus open data licence (free for use). Complements the Planet/SkySat 2024 flood extent layer.",
  },
  {
    id: "oef_modis_ndvi",
    methodology: "Annual mean Normalized Difference Vegetation Index (NDVI) from MODIS Terra MOD13Q1 v6.1, a 16-day composite at 250 m resolution. NDVI = (NIR − Red) / (NIR + Red), where higher values (0.6–0.9) indicate dense, healthy vegetation and lower values (<0.2) indicate bare soil, impervious surfaces, or water. Annual composite computed as the mean of all available 16-day composites for 2024, cloud-masked using the quality flags. Pre-rendered visual tiles on OEF S3.",
    source: "NASA MODIS Terra MOD13Q1 v6.1 — NASA LP DAAC / USGS EROS via Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1",
    date: "Annual mean composite 2024 (16-day composites averaged)",
    resolution: "250 metres per pixel (MODIS native)",
    coverage: "Porto Alegre municipality",
    notes: "NDVI is used as a proxy for canopy cover percentage in the risk analysis pipeline. Low-NDVI urban patches with high heat-risk scores are priority candidates for urban greening NbS. No restrictions on use (NASA open data).",
  },
  {
    id: "oef_merit_hydro",
    methodology: "Height Above Nearest Drainage (HAND) from MERIT Hydro v1.0.1, derived from the MERIT DEM (multi-error-removed improved terrain digital elevation model) at 90 m resolution. HAND measures the elevation of each pixel relative to the nearest downstream drainage channel, computed using the D8 flow routing algorithm. Low HAND values (0–5 m) indicate cells close to stream level — these are the areas most susceptible to fluvial flooding. Pre-rendered visual tiles on OEF S3.",
    source: "MERIT Hydro v1.0.1 — University of Tokyo (Yamazaki et al.) via Google Earth Engine",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/MERIT_Hydro_v1_0_1",
    date: "Static (derived from MERIT DEM; DEM based on SRTM/AW3D30 ~2000–2011)",
    resolution: "90 metres per pixel",
    coverage: "Porto Alegre municipality",
    notes: "HAND is one of the strongest single-variable predictors of fluvial flood susceptibility. Areas with HAND < 2 m along major rivers (Guaíba, Gravataí, Sinos) are the highest-priority zones for wetland restoration and riparian buffer NbS. Licensed CC BY 4.0.",
  },
  {
    id: "oef_slope",
    methodology: "Slope raster derived from Copernicus DEM GLO-30. Computed as the maximum rate of elevation change between each cell and its neighbors.",
    source: "Derived from Copernicus DEM — OpenEarth Foundation",
    date: "2021",
    resolution: "30 meters",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_flow_accumulation",
    methodology: "Flow accumulation raster computed using D8 algorithm on Copernicus DEM. Each pixel value represents the number of upstream cells that drain through it.",
    source: "Derived from Copernicus DEM — OpenEarth Foundation",
    date: "2021",
    resolution: "30 meters",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available. Grid-level flow accumulation is already computed and used in flood risk scoring.",
  },
  {
    id: "oef_canopy_cover",
    methodology: "Tree canopy cover percentage derived from high-resolution satellite imagery and validated against ground truth data.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "10-30 meters",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_flood_hazard",
    methodology: "Flood hazard mapping combining hydrological modeling with terrain analysis to identify areas susceptible to riverine and pluvial flooding.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_heat_hazard",
    methodology: "Urban heat island hazard mapping using land surface temperature from satellite thermal bands, combined with urban morphology indicators.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_exposure",
    methodology: "Population and asset exposure scoring combining population density, building footprints, and critical infrastructure locations.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_cooling",
    methodology: "Urban cooling capacity index based on vegetation coverage, water body proximity, and urban morphology factors that contribute to natural cooling.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_composite_risk",
    methodology: "Composite multi-hazard risk index combining flood, heat, and landslide risk scores with exposure weighting.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_opportunity_zones",
    methodology: "Nature-based solution opportunity zone identification using multi-criteria analysis of risk hotspots, available land, and ecological connectivity.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },

  // ── Climate Sites ─────────────────────────────────────────────────────────
  {
    id: "sites_parks",
    methodology: "Park and green space polygons queried from OpenStreetMap via Overpass API using tags: leisure=park, leisure=garden, leisure=nature_reserve, landuse=recreation_ground. Way and relation elements are converted to polygons via osmtogeojson; node elements (small parks mapped as points) are rendered as circle markers. Results cached server-side on first load.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated by OSM community)",
    resolution: "Individual polygon features at OSM precision",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Additional attributes available in OSM but not currently displayed: area_m2 (polygon area in square metres), operator, access restrictions, opening hours, surface type, lighting. OSM coverage in Porto Alegre is generally excellent for public parks; private gardens may be incomplete.",
  },
  {
    id: "sites_schools",
    methodology: "School and educational facility polygons and points queried from OpenStreetMap using tags: amenity=school, amenity=kindergarten, amenity=university, amenity=college. Polygon footprints are shown where mapped; node elements (point-mapped facilities) fall back to circle markers.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated by OSM community)",
    resolution: "Individual polygon or point features",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Additional attributes available: operator (public/private), capacity (number of students), grades/levels, address, website, wheelchair accessibility. Large university campuses may be mapped as relations; the current pipeline handles outer-ring reconstruction via osmtogeojson.",
  },
  {
    id: "sites_hospitals",
    methodology: "Hospital and health facility polygons and points queried from OpenStreetMap using tags: amenity=hospital, amenity=clinic, amenity=doctors, healthcare=hospital. Polygon footprints shown where available; point markers for node-mapped facilities.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated by OSM community)",
    resolution: "Individual polygon or point features",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Additional attributes available: operator (public/private/NGO), beds, emergency services, speciality, address, website, opening hours. Critical infrastructure layer — important for flood and heat vulnerability analysis. Points may include smaller clinics and general practitioner offices.",
  },
  {
    id: "sites_wetlands",
    methodology: "Wetland areas queried from OpenStreetMap using tags: natural=wetland, water=lagoon, landuse=wetland. Distinct from the base Water Bodies layer which covers all natural=water features; this layer focuses on ecologically classified wetland ecosystems and lagoon systems.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated by OSM community)",
    resolution: "Individual polygon features",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Additional attributes available: wetland subtype (bog, fen, mangrove, marsh, swamp, tidal), name, protected area status. Porto Alegre has significant wetland ecosystems around Guaíba lake and the Jacuí delta. These areas are critical for flood attenuation and biodiversity.",
  },
  {
    id: "sites_sports",
    methodology: "Sports grounds, stadiums and public plazas queried from OpenStreetMap using tags: leisure=sports_pitch, leisure=stadium, leisure=sports_centre, highway=pedestrian, place=square. Includes both large stadium compounds (polygon) and individual sports pitches (may be points).",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated by OSM community)",
    resolution: "Individual polygon or point features",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Additional attributes available: sport type (football, athletics, basketball, etc.), surface (grass, artificial, clay), lit (lighting), access (public/private), capacity. Large impervious surfaces like stadium parking areas are candidates for permeable surface retrofitting and stormwater detention.",
  },
  {
    id: "sites_social",
    methodology: "Community and social facilities queried from OpenStreetMap using tags: amenity=community_centre, amenity=social_facility, amenity=shelter, amenity=place_of_worship. Represents sites with high community footfall that may serve as cooling/heating refuges and evacuation centres.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated by OSM community)",
    resolution: "Individual polygon or point features",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Additional attributes available: social_facility subtype (shelter, group_home, food_bank, etc.), operator, capacity, target group (elderly, disabled, homeless), opening hours, wheelchair accessibility. These facilities are especially relevant for identifying vulnerable population clusters for climate adaptation planning.",
  },
  {
    id: "sites_vacant",
    methodology: "Vacant, brownfield, and abandoned land parcels queried from OpenStreetMap using tags: landuse=brownfield, landuse=vacant, landuse=abandoned. These represent land that is currently underutilised and may be suitable for NbS implementation such as urban greening, pocket parks, stormwater retention basins, or permeable surface retrofits.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated by OSM community)",
    resolution: "Individual polygon features",
    coverage: "Porto Alegre municipality bounding box",
    notes: "OSM coverage of vacant land is variable — many brownfield sites may not be explicitly tagged. Cross-referencing with municipal cadastre data would improve completeness. Additional attributes when available: name, operator, area_m2.",
  },
  {
    id: "sites_flood_zones",
    methodology: "Permanent water and wetland bodies extracted from OpenStreetMap via Overpass API using tags: natural=water, water=lake/river/reservoir/wetland, natural=wetland, landuse=reservoir, waterway=riverbank. Covers all mapped water-adjacent and wetland features in the Porto Alegre bounding box. Includes Lago Guaíba, Delta do Jacuí, Rio Gravataí, Arroio Dilúvio, and associated wetlands — areas inherently at risk of seasonal or flood-event inundation.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated by OSM community)",
    resolution: "Vector polygon features at full OSM precision",
    coverage: "Porto Alegre municipality bounding box — 847 features",
    notes: "This layer represents permanent water bodies and mapped wetlands, not event-specific flood extents. For the observed 2024 flood inundation footprint see the '2024 Flood Extent (Planet/SkySat)' layer. Useful for identifying flood-prone zones and natural flood buffers in NbS siting analysis.",
  },
  {
    id: "sites_flood2024",
    methodology: "Satellite-observed inundation extent for the 2024 Rio Grande do Sul flood, acquired on 2024-05-06 — the peak day of the crisis. The source dataset (rhguaiba_planetskysat_inundacao_obs_20240506.gpkg) was produced by remote sensing analysis of Planet SkySat sub-metre satellite imagery over the Guaíba watershed. The GeoPackage was published at Zenodo (record 14662897) accompanying the AGILE 2025 conference paper 'Centrality and Resilience in the Face of Flooding — A Case Study of Rio Grande do Sul'. Processing pipeline: downloaded from Zenodo (original CRS EPSG:32722, WGS 84/UTM zone 22S); reprojected to WGS84 using GDAL 3.7.3 ogr2ogr; clipped to the Porto Alegre / Guaíba region bounding box (lon -51.60 to -51.00, lat -30.35 to -29.80); exported as GeoJSON FeatureCollection with enriched properties.",
    source: "Planet SkySat satellite imagery — Zenodo record 14662897 (AGILE 2025)",
    sourceUrl: "https://zenodo.org/records/14662897",
    date: "2024-05-06 (flood peak day — observed inundation)",
    resolution: "Sub-metre Planet SkySat imagery; polygon boundaries at ~1–5 m accuracy",
    coverage: "Guaíba watershed — Porto Alegre region; 197 inundation polygons",
    notes: "The May 2024 Rio Grande do Sul floods were the worst in recorded history, affecting ~470 municipalities and 2.3 million hectares statewide. This layer shows only the satellite-observed extent on 2024-05-06 clipped to the Porto Alegre / Guaíba area. It is critical context for NbS project preparation: the inundated footprint defines where retention basins, wetland restoration, and permeable surface interventions are most urgently needed.",
  },
  {
    id: "ref_viirs_lst",
    methodology: "Daytime brightness temperature from the VIIRS instrument on the Suomi NPP/SNPP satellite (Band I5, thermal infrared), served as visual tiles via NASA's Global Imagery Browse Services (GIBS). VIIRS I5 (10.5–12.4 µm) provides a proxy for land surface temperature at 375 m spatial resolution — significantly sharper than MODIS (1 km). The colour scale runs from blue/grey (cool) through orange to red (hot). Tile date shown: 2022-01-15 (austral summer — January is the hottest month in Porto Alegre, providing the most relevant urban heat signal for NbS planning). Tiles are served at native GIBS zoom level 9 (GoogleMapsCompatible_Level9).",
    source: "NASA VIIRS SNPP — Band I5 Day — served via NASA GIBS (WMTS)",
    sourceUrl: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Brightness_Temp_BandI5_Day/",
    date: "Daily product — tile date: 2022-01-15 (austral summer reference)",
    resolution: "375 metres per pixel (VIIRS I5 native resolution)",
    coverage: "Global — displayed over Porto Alegre",
    notes: "This is a tile layer (raster visual), not vector polygons. NASA GIBS is a public WMTS service with no authentication required. Brightness temperature in Band I5 is a close proxy for land surface temperature but is not emissivity-corrected (unlike the official VIIRS LST product). Spatial patterns are reliable for identifying urban heat islands, impervious surface hotspots, and vegetated cool areas — all directly relevant to NbS siting. Cloud cover appears as cooler regions (data gaps). At zoom levels above 9, tiles are interpolated from the native 375 m resolution.",
  },
  // ── Hydrology & Terrain ──────────────────────────────────────────────────
  {
    id: "oef_copernicus_dem",
    methodology: "Copernicus DEM GLO-30 — a digital surface model (DSM) at 30 m horizontal resolution derived from the TanDEM-X radar mission. Processed by Airbus Defence & Space and released by ESA/Copernicus for global coverage. Provides the topographic baseline used in downstream flood-routing and slope-stability analyses across the Porto Alegre region. Visual tiles pre-rendered on OEF S3.",
    source: "Copernicus DEM GLO-30 — ESA / Airbus (TanDEM-X mission)",
    sourceUrl: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model",
    date: "Static (acquisition 2011–2015; released 2021)",
    resolution: "30 metres per pixel",
    coverage: "Porto Alegre municipality",
    notes: "The Copernicus GLO-30 DEM is freely available under the Copernicus Data and Information Policy. It is the primary terrain input for the OEF Flood Risk Index (FRI) calculation combined with CHIRPS extreme-precipitation indices.",
  },
  {
    id: "oef_merit_elv",
    methodology: "MERIT Hydro ELV (bare-earth elevation) is the multi-error-removed improved terrain DEM from the MERIT Hydro v1.0.1 product at 90 m resolution. Errors corrected include speckle noise, stripe artifacts, absolute bias, and tree/building height bias relative to the underlying SRTM and AW3D30 base DEMs. ELV values represent elevation in metres above EGM96 geoid. Visual tiles pre-rendered on OEF S3.",
    source: "MERIT Hydro v1.0.1 (ELV band) — University of Tokyo (Yamazaki et al.)",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/MERIT_Hydro_v1_0_1",
    date: "Static (derived from SRTM/AW3D30 ~2000–2011)",
    resolution: "90 metres per pixel",
    coverage: "Porto Alegre municipality",
    notes: "MERIT ELV is the bare-earth counterpart to MERIT HAND; comparing the two reveals where channel incision has created natural flood buffers. Licensed CC BY 4.0.",
  },
  {
    id: "oef_merit_upa",
    methodology: "MERIT Hydro UPA (upstream drainage area) quantifies, for each pixel, the total area in km² of upstream catchment that drains through that cell. Derived from the D8 flow-routing algorithm applied to the MERIT DEM. Large UPA values indicate major drainage axes — these are the highest-priority corridors for fluvial NbS such as riparian buffers and retention wetlands. Visual tiles pre-rendered on OEF S3.",
    source: "MERIT Hydro v1.0.1 (UPA band) — University of Tokyo (Yamazaki et al.)",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/MERIT_Hydro_v1_0_1",
    date: "Static (derived from SRTM/AW3D30 ~2000–2011)",
    resolution: "90 metres per pixel",
    coverage: "Porto Alegre municipality",
    notes: "UPA is closely correlated with flood magnitude: the Guaíba and Sinos rivers appear as the dominant high-UPA axes. Licensed CC BY 4.0.",
  },
  {
    id: "oef_jrc_occurrence",
    methodology: "JRC Global Surface Water (GSW) — Occurrence band from the Pekel et al. (2016) dataset updated annually. Occurrence (%) gives the fraction of months (1984–2021) during which a pixel was observed as open water in Landsat 5/7/8 imagery. Values of 100% indicate permanent water; values below 50% indicate seasonal or intermittent water bodies. Visual tiles pre-rendered on OEF S3.",
    source: "JRC Global Surface Water v1.4 — EU Joint Research Centre (Pekel et al. 2016)",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater",
    date: "1984–2021 composite (annual update cycle)",
    resolution: "30 metres per pixel (Landsat native)",
    coverage: "Porto Alegre municipality",
    notes: "Complementary to the Seasonality and Transition bands already in the app. Occurrence highlights permanent waterbodies and is used in NbS planning to delineate protected water-retention zones. Public domain (no restrictions).",
  },
  {
    id: "oef_jrc_seasonality",
    methodology: "JRC Global Surface Water (GSW) — Seasonality band. Counts the number of months in 2021 during which each pixel was classified as open water. Pixels with 12 months are permanent water; those with 1–11 months are seasonally inundated. This layer reveals floodplain wetlands that fill during the wet season (Oct–Mar) and dry out during winter — prime candidates for managed flood-retention NbS. Visual tiles pre-rendered on OEF S3.",
    source: "JRC Global Surface Water v1.4 — EU Joint Research Centre (Pekel et al. 2016)",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater",
    date: "2021 (single-year seasonality count)",
    resolution: "30 metres per pixel (Landsat native)",
    coverage: "Porto Alegre municipality",
    notes: "Seasonality months (1–3) indicate marginal wetlands that could be restored as NbS water-retention features at relatively low cost. Public domain.",
  },
  {
    id: "oef_hansen_treecover",
    methodology: "Hansen Global Forest Change v1.11 — Tree canopy cover for year 2000 at 30 m resolution. Derived from Landsat 7 ETM+ imagery by supervised classification trained on high-resolution reference data. Values (0–100%) represent estimated tree canopy closure for all vegetation taller than 5 m. Provides the baseline against which Hansen forest loss (already in the app) is measured. Visual tiles pre-rendered on OEF S3.",
    source: "Hansen Global Forest Change v1.11 (Treecover 2000) — University of Maryland",
    sourceUrl: "https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2023_v1_11",
    date: "Year 2000 baseline (updated annually for loss layer)",
    resolution: "30 metres per pixel (Landsat native)",
    coverage: "Porto Alegre municipality",
    notes: "Differencing Treecover 2000 with the Hansen Loss layer shows net deforestation over two decades — critical for identifying reforestation NbS priorities in the Atlantic Forest buffer around Porto Alegre. No restrictions on use.",
  },
  // ── CHIRPS extreme precipitation indices ─────────────────────────────────
  {
    id: "oef_chirps_r90p_2024",
    methodology: "CHIRPS v2.0 (Climate Hazards Group InfraRed Precipitation with Station data) daily precipitation time series processed to compute the R90p extreme-precipitation index for 2024. R90p is the total precipitation accumulation on days that exceed the 90th percentile wet-day threshold derived from the 1981–2010 climatological baseline. Calculated at 0.05° (~5.5 km) native CHIRPS resolution and pre-rendered to visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "2024 calendar year",
    resolution: "~5.5 km (0.05° native CHIRPS grid)",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "R90p and related exceedance indices (R95p, R99p) directly quantify extreme-precipitation hazard. The 2024 values capture the anomalously wet conditions that drove the May 2024 catastrophic floods. OEF calculated these indices from raw CHIRPS daily grids. CHIRPS data are public domain (CC0).",
  },
  {
    id: "oef_chirps_r90p_clim",
    methodology: "CHIRPS v2.0 R90p climatological baseline: annual mean of R90p computed over the 1981–2010 reference period at 0.05° resolution. Defines the normal level of extreme-precipitation accumulation against which the 2024 anomaly is measured. Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "1981–2010 climatological baseline",
    resolution: "~5.5 km (0.05° native CHIRPS grid)",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Compare with the 2024 layer to identify where extreme-precipitation hazard has intensified. Regions with large positive anomalies are highest-priority NbS intervention zones.",
  },
  {
    id: "oef_chirps_r95p_2024",
    methodology: "CHIRPS v2.0 R95p index for 2024: total precipitation on days exceeding the 95th percentile wet-day threshold of the 1981–2010 baseline. R95p isolates the contribution of very heavy rainfall events to annual precipitation totals. Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "2024 calendar year",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "R95p captures the contribution of heavy rain events above the 95th percentile — more extreme than R90p, highlighting the most severe wet episodes of 2024.",
  },
  {
    id: "oef_chirps_r95p_clim",
    methodology: "CHIRPS v2.0 R95p climatological baseline (1981–2010 annual mean). Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "1981–2010 climatological baseline",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Baseline for R95p comparison. Public domain (CC0).",
  },
  {
    id: "oef_chirps_r99p_2024",
    methodology: "CHIRPS v2.0 R99p index for 2024: total precipitation on days exceeding the 99th percentile wet-day threshold of the 1981–2010 baseline. R99p isolates rare, catastrophic rainfall events — those occurring fewer than 4 days per year on average in the baseline period. Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "2024 calendar year",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "The May 2024 flood rainfall is expected to appear prominently in the R99p 2024 layer. Public domain (CC0).",
  },
  {
    id: "oef_chirps_r99p_clim",
    methodology: "CHIRPS v2.0 R99p climatological baseline (1981–2010). Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "1981–2010 climatological baseline",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Baseline for R99p comparison. Public domain (CC0).",
  },
  {
    id: "oef_chirps_rx1day_2024",
    methodology: "CHIRPS v2.0 RX1day for 2024: the maximum 1-day precipitation total recorded across the full calendar year. This ETCCDI index captures the magnitude of the single most intense rainfall event of the year and is a key indicator for flash-flood and drainage-capacity risk. Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "2024 calendar year",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "RX1day identifies which sub-regions experienced the highest single-day rainfall in 2024 — directly relevant for designing NbS retention capacity. Public domain (CC0).",
  },
  {
    id: "oef_chirps_rx1day_clim",
    methodology: "CHIRPS v2.0 RX1day climatological baseline: annual mean of the maximum 1-day rainfall over 1981–2010. Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "1981–2010 climatological baseline",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Compare with RX1day 2024 to identify areas where single-day extremes have increased. Public domain (CC0).",
  },
  {
    id: "oef_chirps_rx5day_2024",
    methodology: "CHIRPS v2.0 RX5day for 2024: the maximum consecutive 5-day precipitation total recorded in 2024. The 5-day window captures prolonged heavy rain episodes that saturate soils and drive river flooding — the pattern responsible for the May 2024 disaster. Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "2024 calendar year",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "RX5day is directly comparable to design storm return periods used in urban drainage engineering. NbS design specifications should use this index as a reference storm threshold. Public domain (CC0).",
  },
  {
    id: "oef_chirps_rx5day_clim",
    methodology: "CHIRPS v2.0 RX5day climatological baseline: annual mean of the maximum 5-day rainfall over 1981–2010. Pre-rendered visual tiles on OEF S3.",
    source: "CHIRPS v2.0 — Climate Hazards Center, UC Santa Barbara",
    sourceUrl: "https://www.chc.ucsb.edu/data/chirps",
    date: "1981–2010 climatological baseline",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Baseline for RX5day comparison. Public domain (CC0).",
  },
  // ── ERA5-Land extreme temperature indices ─────────────────────────────────
  {
    id: "oef_era5_tnx_2024",
    methodology: "ERA5-Land hourly reanalysis (ECMWF, 9 km) processed to compute the ETCCDI extreme-temperature index TNx for 2024: the annual maximum of the daily minimum temperature (TN). Represents the intensity of the warmest night in the year. High TNx values indicate locations with persistent urban heat-island conditions that prevent nocturnal cooling — critical stress for vulnerable populations and ecosystems. Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) — Copernicus Climate Change Service (C3S)",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "2024 calendar year",
    resolution: "~9 km (ERA5-Land native 0.1°)",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "TNx highlights where nights are warming most intensely — key for locating urban greening and tree-cover NbS to restore nocturnal cooling. ERA5-Land is available under Copernicus licence (free for any use with attribution).",
  },
  {
    id: "oef_era5_tnx_clim",
    methodology: "ERA5-Land TNx climatological baseline (1981–2010 annual mean of the maximum daily minimum temperature). Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) — Copernicus Climate Change Service (C3S)",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "1981–2010 climatological baseline",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Baseline for TNx anomaly analysis. Copernicus open licence.",
  },
  {
    id: "oef_era5_tx90p_2024",
    methodology: "ERA5-Land TX90p for 2024: the number of days in the calendar year where the daily maximum temperature (TX) exceeds the 90th percentile threshold derived from the 1981–2010 baseline. TX90p is the standard ETCCDI index for warm days and quantifies how many more hot days were experienced in 2024 relative to the climatological norm. Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) — Copernicus Climate Change Service (C3S)",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "2024 calendar year",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Areas with high TX90p counts in 2024 have the greatest need for shade-providing NbS (urban forests, green roofs, urban parks). Copernicus open licence.",
  },
  {
    id: "oef_era5_tx90p_clim",
    methodology: "ERA5-Land TX90p climatological baseline (1981–2010 mean annual count of warm days above 90th percentile). Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) — Copernicus Climate Change Service (C3S)",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "1981–2010 climatological baseline",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Baseline for TX90p comparison. Copernicus open licence.",
  },
  {
    id: "oef_era5_tx99p_2024",
    methodology: "ERA5-Land TX99p for 2024: days exceeding the 99th percentile of daily maximum temperature — representing extreme heat events occurring fewer than 4 days/year in the 1981–2010 baseline. TX99p isolates the most dangerous heat episodes that pose acute health risks. Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) — Copernicus Climate Change Service (C3S)",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "2024 calendar year",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "TX99p days map to periods requiring emergency cooling interventions. NbS interventions targeting TX99p hotspots address life-safety climate risks. Copernicus open licence.",
  },
  {
    id: "oef_era5_tx99p_clim",
    methodology: "ERA5-Land TX99p climatological baseline (1981–2010). Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) — Copernicus Climate Change Service (C3S)",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "1981–2010 climatological baseline",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Baseline for TX99p comparison. Copernicus open licence.",
  },
  {
    id: "oef_era5_txx_2024",
    methodology: "ERA5-Land TXx for 2024: the annual maximum of the daily maximum temperature. Represents the single hottest day recorded in the year — the upper bound of experienced heat stress. Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) — Copernicus Climate Change Service (C3S)",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "2024 calendar year",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "TXx is comparable to design standards for building cooling capacity and outdoor worker safety. Copernicus open licence.",
  },
  {
    id: "oef_era5_txx_clim",
    methodology: "ERA5-Land TXx climatological baseline (1981–2010 annual mean of the maximum daily maximum temperature). Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) — Copernicus Climate Change Service (C3S)",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "1981–2010 climatological baseline",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Baseline for TXx comparison. Copernicus open licence.",
  },
  // ── Heatwave Magnitude (observed) ────────────────────────────────────────
  {
    id: "oef_hwm_2024",
    methodology: "Heatwave Magnitude Index (HWM) for 2024 computed from ERA5-Land daily maximum temperature. HWM is defined as the magnitude of the longest heatwave in the year — calculated as the sum of daily maximum temperature anomalies above the 90th-percentile threshold over the duration of the longest consecutive heatwave event. Computed by OEF. Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) via OEF heatwave-indices pipeline",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "2024 calendar year",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "HWM integrates both intensity and duration of heatwaves into a single score. High-HWM areas in 2024 identify where urban greening had the highest potential to reduce acute heat mortality. OEF calculation based on Russo et al. (2015) methodology. Copernicus open licence.",
  },
  {
    id: "oef_hwm_clim",
    methodology: "Heatwave Magnitude Index (HWM) climatological baseline computed from ERA5-Land over 1981–2010. Defines the historical norm of heatwave intensity for comparison with 2024 and future projections. Pre-rendered visual tiles on OEF S3.",
    source: "ERA5-Land (ECMWF) via OEF heatwave-indices pipeline",
    sourceUrl: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
    date: "1981–2010 climatological baseline",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Baseline reference for HWM projection comparisons. Copernicus open licence.",
  },
  // ── Climate Projections — Flood Risk Index ────────────────────────────────
  {
    id: "oef_fri_2024",
    methodology: "OEF Flood Risk Index (FRI) for 2024 — a composite index combining CHIRPS extreme-precipitation intensity (RX5day, R99p) with terrain susceptibility derived from the Copernicus DEM GLO-30 (slope, HAND). Calculated at the CHIRPS 0.05° grid then downscaled to match DEM resolution. FRI values range 0–1, with 1 indicating highest flood risk. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CHIRPS v2.0 + Copernicus DEM GLO-30",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2024 (observed precipitation + static terrain)",
    resolution: "~5.5 km (CHIRPS grid)",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "FRI provides a single actionable risk score for flood-NbS prioritisation. Cells with FRI > 0.7 combined with dense population (GHSL) are the highest-priority intervention zones.",
  },
  {
    id: "oef_fri_2030s_245",
    methodology: "OEF FRI projected for 2030s under SSP2-4.5 (intermediate emissions scenario). Precipitation inputs replaced with CMIP6 multi-model ensemble median projections for the 2030s period; terrain inputs unchanged (Copernicus DEM). Represents a moderate climate trajectory where warming stabilises near 2°C by 2100. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP2-4.5 ensemble + Copernicus DEM",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2030s projection period (SSP2-4.5)",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "SSP2-4.5 is considered the 'middle-of-the-road' scenario consistent with current stated climate policies. NbS investments planned for a 20–30 year horizon should be sized against this scenario at minimum.",
  },
  {
    id: "oef_fri_2030s_585",
    methodology: "OEF FRI projected for 2030s under SSP5-8.5 (high emissions scenario). Uses CMIP6 SSP5-8.5 ensemble median precipitation projections. Represents a high-fossil-fuel pathway leading to ~4–5°C warming by 2100. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP5-8.5 ensemble + Copernicus DEM",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2030s projection period (SSP5-8.5)",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "SSP5-8.5 is the upper-bound scenario. Differences between SSP2-4.5 and SSP5-8.5 in the 2030s are modest; the gap widens substantially by 2050s and 2100s.",
  },
  {
    id: "oef_fri_2050s_245",
    methodology: "OEF FRI projected for 2050s under SSP2-4.5. Mid-century flood risk under a moderate emissions trajectory. Captures the committed warming from historical emissions plus continued moderate growth. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP2-4.5 ensemble + Copernicus DEM",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2050s projection period (SSP2-4.5)",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "The 2050s is the critical decision horizon for most NbS investments — infrastructure built today will need to function under this climate. Key input for resilience planning and financing.",
  },
  {
    id: "oef_fri_2050s_585",
    methodology: "OEF FRI projected for 2050s under SSP5-8.5. Represents the high-end flood-risk scenario at mid-century. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP5-8.5 ensemble + Copernicus DEM",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2050s projection period (SSP5-8.5)",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Comparison with SSP2-4.5 2050s reveals the mitigation benefit of ambitious climate action on flood risk.",
  },
  {
    id: "oef_fri_2100s_245",
    methodology: "OEF FRI projected for end-of-century 2100s under SSP2-4.5. Long-term flood risk under a stabilised warming trajectory. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP2-4.5 ensemble + Copernicus DEM",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2100s projection period (SSP2-4.5)",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "End-of-century projections carry higher uncertainty but frame the long-term risk envelope for strategic NbS planning and green-bond structuring.",
  },
  {
    id: "oef_fri_2100s_585",
    methodology: "OEF FRI projected for end-of-century 2100s under SSP5-8.5 — the worst-case flood-risk scenario. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP5-8.5 ensemble + Copernicus DEM",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2100s projection period (SSP5-8.5)",
    resolution: "~5.5 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Represents a 'no-mitigation' scenario. The contrast between SSP5-8.5 2100s and SSP2-4.5 2100s quantifies the avoided flood risk attributable to global climate action.",
  },
  // ── Climate Projections — Heatwave Magnitude ──────────────────────────────
  {
    id: "oef_hwm_2030s_245",
    methodology: "OEF Heatwave Magnitude Index (HWM) projected for 2030s under SSP2-4.5. Computed from CMIP6 SSP2-4.5 daily maximum temperature ensemble projections using the same Russo et al. (2015) methodology as the observed HWM layers. The 90th-percentile threshold is fixed at the 1981–2010 ERA5-Land baseline. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP2-4.5 ensemble temperature projections",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2030s projection period (SSP2-4.5)",
    resolution: "~9 km (downscaled from CMIP6)",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "HWM projections reveal where heatwave intensity will increase most — informing long-term urban greening and cool-corridor NbS strategies.",
  },
  {
    id: "oef_hwm_2030s_585",
    methodology: "OEF HWM projected for 2030s under SSP5-8.5. Same methodology as SSP2-4.5 but using the high-emissions temperature scenario. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP5-8.5 ensemble temperature projections",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2030s projection period (SSP5-8.5)",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "Near-term scenario divergence between SSP2-4.5 and SSP5-8.5 for heatwave magnitude is modest; differences widen significantly in later periods.",
  },
  {
    id: "oef_hwm_2050s_585",
    methodology: "OEF HWM projected for 2050s under SSP5-8.5. Mid-century heatwave magnitude under the high-emissions pathway. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP5-8.5 ensemble temperature projections",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2050s projection period (SSP5-8.5)",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "By 2050s under SSP5-8.5, HWM in Porto Alegre is projected to increase substantially relative to the 2024 baseline — reinforcing the urgency of urban greening NbS deployment.",
  },
  {
    id: "oef_hwm_2100s_585",
    methodology: "OEF HWM projected for end-of-century 2100s under SSP5-8.5 — the most extreme heat-projection scenario. Pre-rendered visual tiles on OEF S3.",
    source: "OEF calculation — CMIP6 SSP5-8.5 ensemble temperature projections",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "2100s projection period (SSP5-8.5)",
    resolution: "~9 km",
    coverage: "Porto Alegre municipality and surroundings",
    notes: "End-of-century worst-case scenario for heatwave intensity. Used to stress-test NbS designs and quantify the maximum adaptation gap that NbS must bridge.",
  },

  // ── Spatial Queries (postprocessing) ─────────────────────────────────────
  {
    id: "post_settlements_flood",
    methodology: "Client-side spatial query that intersects the IBGE informal settlements vector layer with the OEF Flood Risk Index (FRI) 2024 raster. For each settlement polygon, its centroid is computed and the OEF FRI value tile is fetched at zoom 11 and decoded using the formula value = (R + 256·G + 65536·B + 6) / 100. Only polygons where the decoded FRI value exceeds 0.4 are retained and rendered. This identifies the subset of informal settlements that fall in the highest-risk flood zones according to the OEF raster, combining the spatial precision of the IBGE cadastre with the hazard quantification of the OEF index.",
    source: "OEF Flood Risk Index 2024 × IBGE Informal Settlements (aglomerados subnormais) 2022",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "FRI: 2024; IBGE boundaries: 2022 census (released 2024)",
    resolution: "Vector output derived from IBGE polygon boundaries; raster sampling at OEF ~5 km native resolution",
    coverage: "Porto Alegre municipality — subset of 125 informal settlement polygons where FRI > 0.4",
    notes: "Computed entirely client-side on layer activation. FRI threshold of 0.4 selects settlements in the upper portion of the flood risk distribution. Results depend on the centroid falling within the raster tile footprint — polygons with centroids outside the Porto Alegre tile coverage are excluded.",
  },
  {
    id: "post_bus_heatwave",
    methodology: "Client-side spatial query that intersects the GTFS bus route geometries with the OEF Heatwave Magnitude (HWM) 2024 raster. For each bus route LineString, its midpoint is computed and the OEF HWM value tile is fetched at zoom 11 and decoded using the formula value = (R + 256·G + 65536·B + 600) / 100. Only routes where the decoded HWM value meets or exceeds 10 °C·days are retained and rendered. In Porto Alegre the 2024 HWM raster shows a uniform value of 11.0 °C·days across the city, so the entire bus network qualifies — this is factually correct and reflects that all transit infrastructure in Porto Alegre operated under heatwave conditions in 2024.",
    source: "OEF Heatwave Magnitude 2024 × EPTC Porto Alegre GTFS Static Feed (bus route shapes)",
    sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
    date: "HWM: 2024; GTFS: October 2024 release",
    resolution: "Vector output at GTFS shape point resolution; raster sampling at ERA5-Land ~9 km native resolution",
    coverage: "Porto Alegre municipality — 762 bus route shapes, all qualifying at HWM ≥ 10 °C·days threshold",
    notes: "Computed client-side on layer activation. The uniform HWM value across Porto Alegre means all bus routes pass the threshold, confirming city-wide heatwave exposure of transit infrastructure. HWM threshold of 10 °C·days corresponds to the lower bound of a moderate heatwave event by ERA5-Land climatological standards.",
  },
];

export default function DataPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
      <header
        data-testid="header-data"
        className="h-14 flex items-center px-4 sticky top-0 z-50"
        style={{ backgroundColor: "#001fa8" }}
      >
        <div className="flex items-center gap-3 w-full">
          <Link href="/">
            <a data-testid="link-back-map" className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </a>
          </Link>
          <img src="/oef-logo.svg" alt="OpenEarth" className="w-7 h-7" />
          <span className="text-white text-sm font-medium tracking-wide">
            Data Sources & Methodology
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <p data-testid="text-data-intro" className="text-zinc-400 text-sm mb-8 max-w-3xl">
          Documentation of all evidence layers used in the Project Preparation Data Layers tool.
          Each layer includes its data source, methodology, temporal coverage, spatial resolution, and geographic extent.
        </p>

        {LAYER_SECTIONS.map((section) => {
          const sectionGroups = LAYER_GROUPS.filter((g) => g.section === section.id);
          const isOef = section.id === "oef_catalog";

          return (
            <section key={section.id} className="mb-12">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-6">
                {isOef ? (
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded"
                    style={{ backgroundColor: 'rgba(0,31,168,0.25)', color: '#6B8CFF' }}
                  >
                    {section.label}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    {section.label}
                  </span>
                )}
                <div
                  className="flex-1 h-px"
                  style={isOef ? { backgroundColor: 'rgba(0,31,168,0.4)' } : { backgroundColor: 'rgba(255,255,255,0.07)' }}
                />
              </div>

              {/* Groups inside this section */}
              {sectionGroups.map((group) => {
                const groupLayers = LAYER_CONFIGS.filter((l) => l.group === group.id);
                if (groupLayers.length === 0) return null;

                return (
                  <div key={group.id} className="mb-8">
                    <h2
                      data-testid={`heading-group-${group.id}`}
                      className="text-xs font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2 mb-4"
                    >
                      {group.label}
                    </h2>

                    <div className="space-y-4">
                      {groupLayers.map((layer) => {
                        const info = LAYER_DATA_INFO.find((d) => d.id === layer.id);
                        const Icon = layer.icon;

                        return (
                          <div
                            key={layer.id}
                            data-testid={`card-layer-${layer.id}`}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: layer.color + "22" }}
                              >
                                <Icon className="w-4 h-4" style={{ color: layer.color }} />
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold text-white">{layer.name}</h3>
                                {layer.hasValueTiles && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                    style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                                    Values decoded
                                  </span>
                                )}
                                {!layer.available && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium">
                                    Coming Soon
                                  </span>
                                )}
                              </div>
                            </div>

                            {info ? (
                              <div className="space-y-3 text-sm">
                                <div>
                                  <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Methodology</dt>
                                  <dd className="text-zinc-300 leading-relaxed">{info.methodology}</dd>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Source</dt>
                                    <dd className="text-zinc-300 text-xs">
                                      {info.sourceUrl ? (
                                        <a
                                          href={info.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          data-testid={`link-source-${layer.id}`}
                                          className="hover:text-blue-400 transition-colors inline-flex items-center gap-1"
                                        >
                                          {info.source}
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ) : (
                                        info.source
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Date</dt>
                                    <dd className="text-zinc-300 text-xs">{info.date}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Resolution</dt>
                                    <dd className="text-zinc-300 text-xs">{info.resolution}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Coverage</dt>
                                    <dd className="text-zinc-300 text-xs">{info.coverage}</dd>
                                  </div>
                                </div>

                                {info.notes && (
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Notes</dt>
                                    <dd className="text-zinc-400 text-xs leading-relaxed">{info.notes}</dd>
                                  </div>
                                )}

                                {layer.hasValueTiles && (
                                  <div className="mt-1 rounded-lg border border-emerald-800/40 bg-emerald-950/25 p-3 flex gap-2.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                    <div>
                                      <dt className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                                        Values Available In-Tool
                                      </dt>
                                      <dd className="text-emerald-200/70 text-xs leading-relaxed">
                                        {getInToolValueDescription(layer)}
                                      </dd>
                                    </div>
                                  </div>
                                )}

                                {layer.source === "tiles" && !layer.hasValueTiles && (
                                  <div className="mt-1 rounded-lg border border-amber-800/40 bg-amber-950/25 p-3 flex gap-2.5">
                                    <FlaskConical className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                    <div>
                                      <dt className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                                        For Calculations
                                      </dt>
                                      <dd className="text-amber-200/65 text-xs leading-relaxed">
                                        {getRawDataAccess(layer.id)}
                                      </dd>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-zinc-500 text-xs">Documentation pending.</p>
                                {layer.hasValueTiles && (
                                  <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/25 p-3 flex gap-2.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                    <div>
                                      <dt className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                                        Values Available In-Tool
                                      </dt>
                                      <dd className="text-emerald-200/70 text-xs leading-relaxed">
                                        {getInToolValueDescription(layer)}
                                      </dd>
                                    </div>
                                  </div>
                                )}
                                {layer.source === "tiles" && !layer.hasValueTiles && (
                                  <div className="rounded-lg border border-amber-800/40 bg-amber-950/25 p-3 flex gap-2.5">
                                    <FlaskConical className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                    <div>
                                      <dt className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                                        For Calculations
                                      </dt>
                                      <dd className="text-amber-200/65 text-xs leading-relaxed">
                                        {getRawDataAccess(layer.id)}
                                      </dd>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </main>
    </div>
  );
}

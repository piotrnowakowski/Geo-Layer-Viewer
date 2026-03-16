import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LAYER_CONFIGS, LAYER_GROUPS, LAYER_SECTIONS } from "@/data/layer-configs";

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

const LAYER_DATA_INFO: LayerDataInfo[] = [
  {
    id: "grid_flood",
    methodology: "Composite flood risk index computed from 7 weighted parameters: D8 flow accumulation from DEM (25%), topographic depression detection (15%), river proximity via rank-inverted distance to nearest OSM river LineString (20%), surface water proximity via rank-inverted distance to nearest water body polygon edge (10%), low-lying terrain percentile from elevation (15%), impervious surface coverage from land use classification (10%), and terrain flatness derived from slope (5%). All parameters normalized to 0-1 range before weighting.",
    source: "Derived from Copernicus DEM, OpenStreetMap, ESA WorldCover",
    date: "DEM: 2021, OSM: 2024, WorldCover: 2021",
    resolution: "1 km grid cells",
    coverage: "Porto Alegre municipality boundary",
    notes: "Flow accumulation uses D8 steepest-descent algorithm on DEM raster. Depression cells are those where no neighbor has lower elevation. Proximity metrics use percentile-based rank inversion across all grid cells.",
  },
  {
    id: "grid_heat",
    methodology: "Composite urban heat island risk index computed from 4 weighted parameters: impervious surface percentage (30%), inverse canopy cover (25%), building density normalized to peak cell (25%), and population density normalized to peak cell (20%).",
    source: "Derived from ESA WorldCover, OpenStreetMap buildings, WorldPop",
    date: "WorldCover: 2021, OSM: 2024, WorldPop: 2020",
    resolution: "1 km grid cells",
    coverage: "Porto Alegre municipality boundary",
  },
  {
    id: "grid_landslide",
    methodology: "Composite landslide susceptibility index from 4 parameters: slope steepness from DEM (35%), flow accumulation (25%), inverse canopy cover indicating deforested slopes (20%), and river proximity indicating erosion-prone areas (20%).",
    source: "Derived from Copernicus DEM, ESA WorldCover, OpenStreetMap",
    date: "DEM: 2021, WorldCover: 2021, OSM: 2024",
    resolution: "1 km grid cells",
    coverage: "Porto Alegre municipality boundary",
  },
  {
    id: "elevation",
    methodology: "Elevation contours and raster samples extracted from Copernicus DEM GLO-30 via AWS Open Data. Contour lines generated at fixed elevation intervals from the 30m DEM. Slope is derived from elevation range within each grid cell.",
    source: "Copernicus DEM GLO-30 — European Space Agency",
    sourceUrl: "https://registry.opendata.aws/copernicus-dem/",
    date: "2021 (based on TanDEM-X mission data 2011-2015, updated with auxiliary data)",
    resolution: "30 meters (1 arc-second)",
    coverage: "Porto Alegre municipality — 10,848 raster sample points",
    notes: "Elevation range: -1.7m to 307.8m. Mean elevation: 34.2m. DEM hosted on AWS S3 as Cloud-Optimized GeoTIFF (COG).",
  },
  {
    id: "surface_water",
    methodology: "Surface water body polygons (lakes, lagoons, reservoirs, ponds) extracted from OpenStreetMap via Overpass API using [natural=water], [water=lake/reservoir/lagoon/pond], and [landuse=reservoir] tags.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://wiki.openstreetmap.org/wiki/Tag:natural%3Dwater",
    date: "2024 (continuously updated)",
    resolution: "Vector polygons at full OSM detail",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Includes Guaiba Lake (Lago Guaiba), smaller urban lagoons, and man-made reservoirs. Proximity to water bodies is used in flood risk calculation.",
  },
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
    id: "forest",
    methodology: "Forest canopy polygons extracted from OpenStreetMap via Overpass API using [natural=wood], [landuse=forest], and [leisure=park]+[natural=wood] tags.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://wiki.openstreetmap.org/wiki/Tag:natural%3Dwood",
    date: "2024 (continuously updated)",
    resolution: "Vector polygons at full OSM detail",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Canopy cover percentage per grid cell is used in heat risk and landslide risk calculations. Higher canopy cover reduces both heat island effect and slope erosion risk.",
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
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-white">{layer.name}</h3>
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
                              </div>
                            ) : (
                              <p className="text-zinc-500 text-xs">Documentation pending.</p>
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

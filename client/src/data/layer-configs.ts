import {
  CloudRain,
  Flame,
  Mountain,
  Building2,
  Droplets,
  Trees,
  Grid3X3,
  MapPinned,
  Users,
  Leaf,
  AlertTriangle,
  Bus,
  MapPin,
  Sun,
  BarChart3,
  Home,
  Waves,
  Moon,
  Thermometer,
  TrendingUp,
} from "lucide-react";

export type LayerSource = "geojson" | "tiles";
export type LayerSection = "oef_catalog" | "postprocessing";
export type LayerGroup =
  | "urban_land"
  | "environment"
  | "population"
  | "hydrology"
  | "climate_extreme"
  | "climate_projections"
  | "spatial_queries";

// Value-tile encoding from OEF GitHub catalog (datasets.yaml).
// Formula for numeric layers: value = (R + 256*G + 65536*B + offset) / scale
// Formula for categorical layers: class_id = R  (G=B=0)
export interface ValueTileEncoding {
  type: "numeric" | "categorical";
  scale?: number;
  offset?: number;
  unit?: string;
  urlTemplate?: string;
  classes?: Record<number, string>;
}

export interface LayerConfig {
  id: string;
  name: string;
  icon: any;
  color: string;
  source: LayerSource;
  group: LayerGroup;
  available: boolean;
  tileLayerId?: string;
  // Whether real numerical/categorical values can be decoded at any pixel.
  // true  → value_tile confirmed accessible (tile layers) OR inline GeoJSON values.
  // false → visual PNG tiles only; pixel = display colour, not a data value.
  hasValueTiles?: boolean;
  valueEncoding?: ValueTileEncoding;
}

export interface LayerState extends LayerConfig {
  enabled: boolean;
  loaded: boolean;
  loading: boolean;
  data: any;
}

export interface LayerGroupDef {
  id: LayerGroup;
  label: string;
  section: LayerSection;
}

export interface LayerSectionDef {
  id: LayerSection;
  label: string;
}

export const LAYER_SECTIONS: LayerSectionDef[] = [
  { id: "oef_catalog",     label: "OEF Geospatial Data" },
  { id: "postprocessing",  label: "Spatial Queries" },
];

export const LAYER_GROUPS: LayerGroupDef[] = [
  { id: "urban_land",         label: "Land Use & Urban Form",    section: "oef_catalog"    },
  { id: "environment",        label: "Environment & Ecology",    section: "oef_catalog"    },
  { id: "population",         label: "Population & Society",     section: "oef_catalog"    },
  { id: "hydrology",          label: "Hydrology & Terrain",      section: "oef_catalog"    },
  { id: "climate_extreme",    label: "Extreme Climate Indices",  section: "oef_catalog"    },
  { id: "climate_projections",label: "Climate Projections",      section: "oef_catalog"    },
  { id: "spatial_queries",    label: "Spatial Queries",          section: "postprocessing" },
];

// ── Value-tile URL templates (from OEF GitHub catalog datasets.yaml) ─────────
// Confirmed accessible via HTTP probe on 2026-03-16.
// Formula: value = (R + 256*G + 65536*B + offset) / scale
const S3 = "https://geo-test-api.s3.us-east-1.amazonaws.com";
const vtUrl = (path: string) => `${S3}/${path}/tiles_values/{z}/{x}/{y}.png`;

export const LAYER_CONFIGS: LayerConfig[] = [
  // ── OEF Catalog → Land Use & Urban Form ────────────────────────────────────
  {
    id: "oef_dynamic_world", name: "Land Use (Dynamic World)", icon: Grid3X3, color: "#06d6a0",
    source: "tiles", group: "urban_land", available: true, tileLayerId: "dynamic_world",
    hasValueTiles: true,
    valueEncoding: {
      type: "categorical",
      urlTemplate: vtUrl("dynamic_world/release/v1/2023/porto_alegre"),
      classes: { 0:"Water", 1:"Trees", 2:"Grass", 3:"Flooded veg", 4:"Crops", 5:"Shrub", 6:"Built", 7:"Bare", 8:"Snow" },
    },
  },
  { id: "oef_ghsl_built_up",    name: "Built-Up Surface (GHSL)",       icon: Building2,    color: "#ef4444", source: "tiles",   group: "urban_land",  available: true,  tileLayerId: "ghsl_built_up",       hasValueTiles: false },
  { id: "oef_ghsl_urbanization",name: "Degree of Urbanisation (GHSL)", icon: MapPinned,    color: "#f97316", source: "tiles",   group: "urban_land",  available: true,  tileLayerId: "ghsl_urbanization",   hasValueTiles: false },
  { id: "oef_viirs_nightlights",name: "Night Lights (VIIRS DNB)",      icon: Moon,         color: "#fbbf24", source: "tiles",   group: "urban_land",  available: true,  tileLayerId: "viirs_nightlights",   hasValueTiles: false },
  { id: "oef_opportunity_zones",name: "NbS Opportunity Zones",         icon: MapPinned,    color: "#06d6a0", source: "tiles",   group: "urban_land",  available: false },

  // ── OEF Catalog → Environment & Ecology ────────────────────────────────────
  { id: "solar_potential",  name: "Solar Potential",               icon: Sun,  color: "#f59e0b", source: "geojson", group: "environment", available: true,  hasValueTiles: true, valueEncoding: { type: "numeric", unit: "kWh/kWp/d" } },
  { id: "oef_solar_tiles",  name: "Solar PV Potential",            icon: Sun,  color: "#eab308", source: "tiles",   group: "environment", available: true,  tileLayerId: "solar_pvout",         hasValueTiles: false },
  { id: "oef_modis_ndvi",   name: "Vegetation Index NDVI (MODIS)", icon: Leaf, color: "#4ade80", source: "tiles",   group: "environment", available: true,  tileLayerId: "modis_ndvi",          hasValueTiles: false },
  { id: "oef_hansen_forest",name: "Forest Loss 2000–2024 (Hansen)",icon: Trees,color: "#dc2626", source: "tiles",   group: "environment", available: true,  tileLayerId: "hansen_forest_loss",  hasValueTiles: false },
  { id: "oef_canopy_cover", name: "Canopy Cover",                  icon: Trees,color: "#588157", source: "tiles",   group: "environment", available: false },
  { id: "oef_heat_hazard",  name: "Heat Hazard",                   icon: Flame,color: "#d00000", source: "tiles",   group: "environment", available: false },
  { id: "oef_cooling",      name: "Cooling Capacity",              icon: Leaf, color: "#2d6a4f", source: "tiles",   group: "environment", available: false },
  { id: "oef_composite_risk",name:"Composite Risk",                icon: AlertTriangle, color: "#e63946", source: "tiles", group: "environment", available: false },

  // ── OEF Catalog → Population & Society ─────────────────────────────────────
  { id: "oef_ghsl_population", name: "Population Grid (GHSL)",  icon: Users,    color: "#8b5cf6", source: "tiles",   group: "population", available: true,  tileLayerId: "ghsl_population", hasValueTiles: false },
  { id: "ibge_census",         name: "Census Indicators",       icon: BarChart3,color: "#a855f7", source: "geojson", group: "population", available: true,  hasValueTiles: true, valueEncoding: { type: "numeric", unit: "% poverty" } },
  { id: "ibge_settlements",    name: "Informal Settlements",    icon: Home,     color: "#f43f5e", source: "geojson", group: "population", available: true,  hasValueTiles: true },
  { id: "transit_routes",      name: "Bus Routes",              icon: Bus,      color: "#06b6d4", source: "geojson", group: "population", available: true,  hasValueTiles: true },
  { id: "transit_stops",       name: "Bus Stops",               icon: MapPin,   color: "#14b8a6", source: "geojson", group: "population", available: true,  hasValueTiles: true },
  { id: "oef_exposure",        name: "Exposure Score",          icon: Users,    color: "#7b2cbf", source: "tiles",   group: "population", available: false },

  // ── OEF Catalog → Hydrology & Terrain ──────────────────────────────────────
  { id: "oef_copernicus_dem",   name: "DEM Elevation (Copernicus)",    icon: Mountain, color: "#a16207", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "copernicus_dem_visual", hasValueTiles: false },
  { id: "oef_merit_elv",        name: "Terrain Elevation (MERIT)",     icon: Mountain, color: "#bc6c25", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "merit_elv",            hasValueTiles: false },
  { id: "oef_merit_upa",        name: "Upstream Area (MERIT)",         icon: Droplets, color: "#0369a1", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "merit_upa",            hasValueTiles: false },
  { id: "oef_merit_hydro",      name: "Height Above Drainage (MERIT)", icon: Droplets, color: "#0ea5e9", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "merit_hydro_hand",     hasValueTiles: false },
  { id: "oef_slope",            name: "Slope",                         icon: Mountain, color: "#bc6c25", source: "tiles",   group: "hydrology", available: false },
  { id: "oef_flow_accumulation",name: "Flow Accumulation",             icon: Droplets, color: "#0077b6", source: "tiles",   group: "hydrology", available: false },
  { id: "oef_jrc_occurrence",   name: "Surface Water Occurrence (JRC)",icon: Waves,    color: "#1d4ed8", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "jrc_occurrence",       hasValueTiles: false },
  { id: "oef_jrc_seasonality",  name: "Surface Water Seasonality (JRC)",icon:Waves,   color: "#0891b2", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "jrc_seasonality",      hasValueTiles: false },
  { id: "oef_jrc_surface_water",name: "Surface Water Change (JRC)",    icon: Waves,    color: "#0077b6", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "jrc_surface_water",    hasValueTiles: false },
  { id: "oef_hansen_treecover", name: "Tree Cover 2000 (Hansen)",      icon: Trees,    color: "#166534", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "hansen_treecover2000", hasValueTiles: false },
  { id: "oef_emsn194",          name: "2024 Flood Depth (Copernicus)", icon: CloudRain,color: "#1d4ed8", source: "tiles",   group: "hydrology", available: true,  tileLayerId: "copernicus_emsn194",   hasValueTiles: false },
  { id: "oef_flood_hazard",     name: "Flood Hazard",                  icon: CloudRain,color: "#023e8a", source: "tiles",   group: "hydrology", available: false },

  // ── OEF Catalog → Extreme Climate Indices ──────────────────────────────────
  // CHIRPS — all confirmed accessible value_tiles (V2_0 path, scale=100)
  {
    id: "oef_chirps_r90p_2024", name: "Prec. R90p 2024 (CHIRPS)", icon: CloudRain, color: "#1e40af",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r90p_2024",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 49960, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/r90p") },
  },
  {
    id: "oef_chirps_r90p_clim", name: "Prec. R90p Baseline (CHIRPS)", icon: CloudRain, color: "#3b82f6",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r90p_clim",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 37045, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/r90p") },
  },
  {
    id: "oef_chirps_r95p_2024", name: "Prec. R95p 2024 (CHIRPS)", icon: CloudRain, color: "#1e3a8a",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r95p_2024",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 31068, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/r95p") },
  },
  {
    id: "oef_chirps_r95p_clim", name: "Prec. R95p Baseline (CHIRPS)", icon: CloudRain, color: "#2563eb",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r95p_clim",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 21819, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/r95p") },
  },
  {
    id: "oef_chirps_r99p_2024", name: "Prec. R99p 2024 (CHIRPS)", icon: CloudRain, color: "#172554",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r99p_2024",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 12196, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/r99p") },
  },
  {
    id: "oef_chirps_r99p_clim", name: "Prec. R99p Baseline (CHIRPS)", icon: CloudRain, color: "#1d4ed8",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r99p_clim",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 8476, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/r99p") },
  },
  {
    id: "oef_chirps_rx1day_2024", name: "Max 1-day Prec. 2024 (CHIRPS)", icon: CloudRain, color: "#075985",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_rx1day_2024",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 6459, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/rx1day") },
  },
  {
    id: "oef_chirps_rx1day_clim", name: "Max 1-day Prec. Baseline", icon: CloudRain, color: "#0ea5e9",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_rx1day_clim",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 5727, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/rx1day") },
  },
  {
    id: "oef_chirps_rx5day_2024", name: "Max 5-day Prec. 2024 (CHIRPS)", icon: CloudRain, color: "#164e63",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_rx5day_2024",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 17535, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/2024/rx5day") },
  },
  {
    id: "oef_chirps_rx5day_clim", name: "Max 5-day Prec. Baseline", icon: CloudRain, color: "#06b6d4",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_rx5day_clim",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 11014, unit: "mm",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/annual_climatology/rx5day") },
  },
  // ERA5 — value_tiles return 403 (visual only)
  { id: "oef_era5_tnx_2024",   name: "Min Temp Max TNx 2024 (ERA5)",   icon: Thermometer, color: "#b45309", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tnx_2024",  hasValueTiles: false },
  { id: "oef_era5_tnx_clim",   name: "Min Temp Max TNx Baseline",      icon: Thermometer, color: "#d97706", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tnx_clim",  hasValueTiles: false },
  { id: "oef_era5_tx90p_2024", name: "Hot Days TX90p 2024 (ERA5)",     icon: Thermometer, color: "#c2410c", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tx90p_2024",hasValueTiles: false },
  { id: "oef_era5_tx90p_clim", name: "Hot Days TX90p Baseline",        icon: Thermometer, color: "#ea580c", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tx90p_clim",hasValueTiles: false },
  { id: "oef_era5_tx99p_2024", name: "Extreme Heat TX99p 2024 (ERA5)", icon: Thermometer, color: "#991b1b", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tx99p_2024",hasValueTiles: false },
  { id: "oef_era5_tx99p_clim", name: "Extreme Heat TX99p Baseline",    icon: Thermometer, color: "#b91c1c", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tx99p_clim",hasValueTiles: false },
  { id: "oef_era5_txx_2024",   name: "Max Temp TXx 2024 (ERA5)",       icon: Thermometer, color: "#7f1d1d", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_txx_2024",  hasValueTiles: false },
  { id: "oef_era5_txx_clim",   name: "Max Temp TXx Baseline",          icon: Thermometer, color: "#dc2626", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_txx_clim",  hasValueTiles: false },
  // HWM — 2024 + projections confirmed accessible; climatology 403
  {
    id: "oef_hwm_2024", name: "Heatwave Magnitude 2024 (ERA5)", icon: Flame, color: "#d97706",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "hwm_2024",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 600, unit: "°C·days",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/2024") },
  },
  { id: "oef_hwm_clim", name: "Heatwave Magnitude Baseline", icon: Flame, color: "#f59e0b",
    source: "tiles", group: "climate_extreme", available: true, tileLayerId: "hwm_clim", hasValueTiles: false },

  // ── OEF Catalog → Climate Projections ──────────────────────────────────────
  // FRI — 2024 + multiple scenarios confirmed accessible
  {
    id: "oef_fri_2024", name: "Flood Risk Index 2024", icon: CloudRain, color: "#1e3a8a",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2024",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 6, unit: "index 0–1",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2024") },
  },
  {
    id: "oef_fri_2030s_245", name: "Flood Risk 2030s SSP2-4.5", icon: TrendingUp, color: "#1e40af",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2030s_245",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 1, unit: "index 0–1",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2030s_ssp245") },
  },
  { id: "oef_fri_2030s_585", name: "Flood Risk 2030s SSP5-8.5", icon: TrendingUp, color: "#1d4ed8",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2030s_585", hasValueTiles: false,
    valueEncoding: { type: "numeric", scale: 100, offset: 13, unit: "index 0–1" } },
  { id: "oef_fri_2050s_245", name: "Flood Risk 2050s SSP2-4.5", icon: TrendingUp, color: "#2563eb",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2050s_245", hasValueTiles: false,
    valueEncoding: { type: "numeric", scale: 100, offset: 9, unit: "index 0–1" } },
  {
    id: "oef_fri_2050s_585", name: "Flood Risk 2050s SSP5-8.5", icon: TrendingUp, color: "#3b82f6",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2050s_585",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 0, unit: "index 0–1",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/2050s_ssp585") },
  },
  { id: "oef_fri_2100s_245", name: "Flood Risk 2100s SSP2-4.5", icon: TrendingUp, color: "#60a5fa",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2100s_245", hasValueTiles: false,
    valueEncoding: { type: "numeric", scale: 100, offset: 0, unit: "index 0–1" } },
  { id: "oef_fri_2100s_585", name: "Flood Risk 2100s SSP5-8.5", icon: TrendingUp, color: "#93c5fd",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2100s_585", hasValueTiles: false,
    valueEncoding: { type: "numeric", scale: 100, offset: 0, unit: "index 0–1" } },
  // HWM projections
  {
    id: "oef_hwm_2030s_245", name: "Heatwave Mag. 2030s SSP2-4.5", icon: TrendingUp, color: "#b45309",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "hwm_2030s_245",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 1035, unit: "°C·days",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/2030s_ssp245") },
  },
  { id: "oef_hwm_2030s_585", name: "Heatwave Mag. 2030s SSP5-8.5", icon: TrendingUp, color: "#d97706",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "hwm_2030s_585", hasValueTiles: false,
    valueEncoding: { type: "numeric", scale: 100, offset: 1003, unit: "°C·days" } },
  { id: "oef_hwm_2050s_585", name: "Heatwave Mag. 2050s SSP5-8.5", icon: TrendingUp, color: "#f59e0b",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "hwm_2050s_585", hasValueTiles: false,
    valueEncoding: { type: "numeric", scale: 100, offset: 1003, unit: "°C·days" } },
  {
    id: "oef_hwm_2100s_585", name: "Heatwave Mag. 2100s SSP5-8.5", icon: TrendingUp, color: "#fbbf24",
    source: "tiles", group: "climate_projections", available: true, tileLayerId: "hwm_2100s_585",
    hasValueTiles: true,
    valueEncoding: { type: "numeric", scale: 100, offset: 2383, unit: "°C·days",
      urlTemplate: vtUrl("nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/2100s_ssp585") },
  },

  // ── Spatial Queries (postprocessing) ────────────────────────────────────────
  // Vector × raster intersections: features filtered by raster threshold at centroid.
  {
    id: "post_settlements_flood",
    name: "Settlements @ FRI > 0.4",
    icon: AlertTriangle,
    color: "#ef4444",
    source: "geojson",
    group: "spatial_queries",
    available: true,
    hasValueTiles: true,
    valueEncoding: { type: "numeric", unit: "FRI index" },
  },
  {
    id: "post_bus_heatwave",
    name: "Bus Lines in HWM ≥ 10 °C·d",
    icon: Flame,
    color: "#fb923c",
    source: "geojson",
    group: "spatial_queries",
    available: true,
    hasValueTiles: true,
    valueEncoding: { type: "numeric", unit: "°C·days" },
  },
];

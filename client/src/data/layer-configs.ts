import {
  CloudRain,
  Flame,
  Mountain,
  Building2,
  Droplets,
  Trees,
  Map as MapIcon,
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
  Heart,
  GraduationCap,
  Dumbbell,
  Waves,
  HandHeart,
  Moon,
  Thermometer,
  TrendingUp,
} from "lucide-react";

export type LayerSource = "geojson" | "tiles";
export type LayerSection = "oef_catalog" | "derived";
export type LayerGroup =
  | "urban_land"
  | "environment"
  | "population"
  | "hydrology"
  | "climate_extreme"
  | "climate_projections"
  | "analysis"
  | "base_layers"
  | "sites";

export interface LayerConfig {
  id: string;
  name: string;
  icon: any;
  color: string;
  source: LayerSource;
  group: LayerGroup;
  available: boolean;
  tileLayerId?: string;
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
  { id: "oef_catalog", label: "OEF Geospatial Data" },
  { id: "derived", label: "Reference Layers" },
];

export const LAYER_GROUPS: LayerGroupDef[] = [
  { id: "urban_land",         label: "Land Use & Urban Form",    section: "oef_catalog" },
  { id: "environment",        label: "Environment & Ecology",    section: "oef_catalog" },
  { id: "population",         label: "Population & Society",     section: "oef_catalog" },
  { id: "hydrology",          label: "Hydrology & Terrain",      section: "oef_catalog" },
  { id: "climate_extreme",    label: "Extreme Climate Indices",  section: "oef_catalog" },
  { id: "climate_projections",label: "Climate Projections",      section: "oef_catalog" },
  { id: "analysis",           label: "Risk Analysis",            section: "derived"     },
  { id: "base_layers",        label: "Base Layers",              section: "derived"     },
  { id: "sites",              label: "Climate Sites",            section: "derived"     },
];

export const LAYER_CONFIGS: LayerConfig[] = [
  // ── OEF Catalog → Land Use & Urban Form ────────────────────────────────────
  { id: "oef_dynamic_world",    name: "Land Use (Dynamic World)",       icon: Grid3X3,      color: "#06d6a0", source: "tiles",   group: "urban_land",  available: true,  tileLayerId: "dynamic_world" },
  { id: "oef_ghsl_built_up",    name: "Built-Up Surface (GHSL)",        icon: Building2,    color: "#ef4444", source: "tiles",   group: "urban_land",  available: true,  tileLayerId: "ghsl_built_up" },
  { id: "oef_ghsl_urbanization",name: "Degree of Urbanisation (GHSL)",  icon: MapPinned,    color: "#f97316", source: "tiles",   group: "urban_land",  available: true,  tileLayerId: "ghsl_urbanization" },
  { id: "oef_viirs_nightlights",name: "Night Lights (VIIRS DNB)",       icon: Moon,         color: "#fbbf24", source: "tiles",   group: "urban_land",  available: true,  tileLayerId: "viirs_nightlights" },
  { id: "oef_opportunity_zones",name: "NbS Opportunity Zones",          icon: MapPinned,    color: "#06d6a0", source: "tiles",   group: "urban_land",  available: false },

  // ── OEF Catalog → Environment & Ecology ────────────────────────────────────
  { id: "solar_potential",      name: "Solar Potential",                icon: Sun,          color: "#f59e0b", source: "geojson", group: "environment", available: true },
  { id: "oef_solar_tiles",      name: "Solar PV Potential",             icon: Sun,          color: "#eab308", source: "tiles",   group: "environment", available: true,  tileLayerId: "solar_pvout" },
  { id: "oef_modis_ndvi",       name: "Vegetation Index NDVI (MODIS)",  icon: Leaf,         color: "#4ade80", source: "tiles",   group: "environment", available: true,  tileLayerId: "modis_ndvi" },
  { id: "oef_hansen_forest",    name: "Forest Loss 2000–2024 (Hansen)", icon: Trees,        color: "#dc2626", source: "tiles",   group: "environment", available: true,  tileLayerId: "hansen_forest_loss" },
  { id: "oef_canopy_cover",     name: "Canopy Cover",                   icon: Trees,        color: "#588157", source: "tiles",   group: "environment", available: false },
  { id: "oef_heat_hazard",      name: "Heat Hazard",                    icon: Flame,        color: "#d00000", source: "tiles",   group: "environment", available: false },
  { id: "oef_cooling",          name: "Cooling Capacity",               icon: Leaf,         color: "#2d6a4f", source: "tiles",   group: "environment", available: false },
  { id: "oef_composite_risk",   name: "Composite Risk",                 icon: AlertTriangle,color: "#e63946", source: "tiles",   group: "environment", available: false },

  // ── OEF Catalog → Population & Society ─────────────────────────────────────
  { id: "oef_ghsl_population",  name: "Population Grid (GHSL)",         icon: Users,        color: "#8b5cf6", source: "tiles",   group: "population",  available: true,  tileLayerId: "ghsl_population" },
  { id: "ibge_census",          name: "Census Indicators",              icon: BarChart3,    color: "#a855f7", source: "geojson", group: "population",  available: true },
  { id: "ibge_settlements",     name: "Informal Settlements",           icon: Home,         color: "#f43f5e", source: "geojson", group: "population",  available: true },
  { id: "transit_routes",       name: "Bus Routes",                     icon: Bus,          color: "#06b6d4", source: "geojson", group: "population",  available: true },
  { id: "transit_stops",        name: "Bus Stops",                      icon: MapPin,       color: "#14b8a6", source: "geojson", group: "population",  available: true },
  { id: "oef_exposure",         name: "Exposure Score",                 icon: Users,        color: "#7b2cbf", source: "tiles",   group: "population",  available: false },

  // ── OEF Catalog → Hydrology & Terrain ──────────────────────────────────────
  // Terrain elevation
  { id: "oef_copernicus_dem",   name: "DEM Elevation (Copernicus)",     icon: Mountain,     color: "#a16207", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "copernicus_dem_visual" },
  { id: "oef_merit_elv",        name: "Terrain Elevation (MERIT)",      icon: Mountain,     color: "#bc6c25", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "merit_elv" },
  { id: "oef_merit_upa",        name: "Upstream Area (MERIT)",          icon: Droplets,     color: "#0369a1", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "merit_upa" },
  { id: "oef_merit_hydro",      name: "Height Above Drainage (MERIT)",  icon: Droplets,     color: "#0ea5e9", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "merit_hydro_hand" },
  { id: "oef_slope",            name: "Slope",                          icon: Mountain,     color: "#bc6c25", source: "tiles",   group: "hydrology",   available: false },
  { id: "oef_flow_accumulation",name: "Flow Accumulation",              icon: Droplets,     color: "#0077b6", source: "tiles",   group: "hydrology",   available: false },
  // Surface water
  { id: "oef_jrc_occurrence",   name: "Surface Water Occurrence (JRC)", icon: Waves,        color: "#1d4ed8", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "jrc_occurrence" },
  { id: "oef_jrc_seasonality",  name: "Surface Water Seasonality (JRC)",icon: Waves,        color: "#0891b2", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "jrc_seasonality" },
  { id: "oef_jrc_surface_water",name: "Surface Water Change (JRC)",     icon: Waves,        color: "#0077b6", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "jrc_surface_water" },
  // Vegetation cover & flood observation
  { id: "oef_hansen_treecover", name: "Tree Cover 2000 (Hansen)",       icon: Trees,        color: "#166534", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "hansen_treecover2000" },
  { id: "oef_emsn194",          name: "2024 Flood Depth (Copernicus)",  icon: CloudRain,    color: "#1d4ed8", source: "tiles",   group: "hydrology",   available: true,  tileLayerId: "copernicus_emsn194" },
  { id: "oef_flood_hazard",     name: "Flood Hazard",                   icon: CloudRain,    color: "#023e8a", source: "tiles",   group: "hydrology",   available: false },

  // ── OEF Catalog → Extreme Climate Indices ──────────────────────────────────
  // CHIRPS extreme precipitation
  { id: "oef_chirps_r90p_2024",    name: "Prec. R90p 2024 (CHIRPS)",      icon: CloudRain,    color: "#1e40af", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r90p_2024" },
  { id: "oef_chirps_r90p_clim",    name: "Prec. R90p Baseline (CHIRPS)",  icon: CloudRain,    color: "#3b82f6", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r90p_clim" },
  { id: "oef_chirps_r95p_2024",    name: "Prec. R95p 2024 (CHIRPS)",      icon: CloudRain,    color: "#1e3a8a", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r95p_2024" },
  { id: "oef_chirps_r95p_clim",    name: "Prec. R95p Baseline (CHIRPS)",  icon: CloudRain,    color: "#2563eb", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r95p_clim" },
  { id: "oef_chirps_r99p_2024",    name: "Prec. R99p 2024 (CHIRPS)",      icon: CloudRain,    color: "#172554", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r99p_2024" },
  { id: "oef_chirps_r99p_clim",    name: "Prec. R99p Baseline (CHIRPS)",  icon: CloudRain,    color: "#1d4ed8", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_r99p_clim" },
  { id: "oef_chirps_rx1day_2024",  name: "Max 1-day Prec. 2024 (CHIRPS)",icon: CloudRain,    color: "#075985", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_rx1day_2024" },
  { id: "oef_chirps_rx1day_clim",  name: "Max 1-day Prec. Baseline",      icon: CloudRain,    color: "#0ea5e9", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_rx1day_clim" },
  { id: "oef_chirps_rx5day_2024",  name: "Max 5-day Prec. 2024 (CHIRPS)",icon: CloudRain,    color: "#164e63", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_rx5day_2024" },
  { id: "oef_chirps_rx5day_clim",  name: "Max 5-day Prec. Baseline",      icon: CloudRain,    color: "#06b6d4", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "chirps_rx5day_clim" },
  // ERA5-Land extreme temperature
  { id: "oef_era5_tnx_2024",      name: "Min Temp Max TNx 2024 (ERA5)",  icon: Thermometer,  color: "#b45309", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tnx_2024" },
  { id: "oef_era5_tnx_clim",      name: "Min Temp Max TNx Baseline",     icon: Thermometer,  color: "#d97706", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tnx_clim" },
  { id: "oef_era5_tx90p_2024",    name: "Hot Days TX90p 2024 (ERA5)",    icon: Thermometer,  color: "#c2410c", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tx90p_2024" },
  { id: "oef_era5_tx90p_clim",    name: "Hot Days TX90p Baseline",       icon: Thermometer,  color: "#ea580c", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tx90p_clim" },
  { id: "oef_era5_tx99p_2024",    name: "Extreme Heat TX99p 2024 (ERA5)",icon: Thermometer,  color: "#991b1b", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tx99p_2024" },
  { id: "oef_era5_tx99p_clim",    name: "Extreme Heat TX99p Baseline",   icon: Thermometer,  color: "#b91c1c", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_tx99p_clim" },
  { id: "oef_era5_txx_2024",      name: "Max Temp TXx 2024 (ERA5)",      icon: Thermometer,  color: "#7f1d1d", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_txx_2024" },
  { id: "oef_era5_txx_clim",      name: "Max Temp TXx Baseline",         icon: Thermometer,  color: "#dc2626", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "era5_txx_clim" },
  // ERA5-Land heatwave magnitude (observed)
  { id: "oef_hwm_2024",           name: "Heatwave Magnitude 2024 (ERA5)",icon: Flame,        color: "#d97706", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "hwm_2024" },
  { id: "oef_hwm_clim",           name: "Heatwave Magnitude Baseline",   icon: Flame,        color: "#f59e0b", source: "tiles", group: "climate_extreme", available: true, tileLayerId: "hwm_clim" },

  // ── OEF Catalog → Climate Projections ──────────────────────────────────────
  // Flood Risk Index — present + scenarios
  { id: "oef_fri_2024",           name: "Flood Risk Index 2024",           icon: CloudRain,    color: "#1e3a8a", source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2024" },
  { id: "oef_fri_2030s_245",      name: "Flood Risk 2030s SSP2-4.5",       icon: TrendingUp,   color: "#1e40af", source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2030s_245" },
  { id: "oef_fri_2030s_585",      name: "Flood Risk 2030s SSP5-8.5",       icon: TrendingUp,   color: "#1d4ed8", source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2030s_585" },
  { id: "oef_fri_2050s_245",      name: "Flood Risk 2050s SSP2-4.5",       icon: TrendingUp,   color: "#2563eb", source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2050s_245" },
  { id: "oef_fri_2050s_585",      name: "Flood Risk 2050s SSP5-8.5",       icon: TrendingUp,   color: "#3b82f6", source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2050s_585" },
  { id: "oef_fri_2100s_245",      name: "Flood Risk 2100s SSP2-4.5",       icon: TrendingUp,   color: "#60a5fa", source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2100s_245" },
  { id: "oef_fri_2100s_585",      name: "Flood Risk 2100s SSP5-8.5",       icon: TrendingUp,   color: "#93c5fd", source: "tiles", group: "climate_projections", available: true, tileLayerId: "fri_2100s_585" },
  // Heatwave Magnitude — projections
  { id: "oef_hwm_2030s_245",      name: "Heatwave Mag. 2030s SSP2-4.5",   icon: TrendingUp,   color: "#b45309", source: "tiles", group: "climate_projections", available: true, tileLayerId: "hwm_2030s_245" },
  { id: "oef_hwm_2030s_585",      name: "Heatwave Mag. 2030s SSP5-8.5",   icon: TrendingUp,   color: "#d97706", source: "tiles", group: "climate_projections", available: true, tileLayerId: "hwm_2030s_585" },
  { id: "oef_hwm_2050s_585",      name: "Heatwave Mag. 2050s SSP5-8.5",   icon: TrendingUp,   color: "#f59e0b", source: "tiles", group: "climate_projections", available: true, tileLayerId: "hwm_2050s_585" },
  { id: "oef_hwm_2100s_585",      name: "Heatwave Mag. 2100s SSP5-8.5",   icon: TrendingUp,   color: "#fbbf24", source: "tiles", group: "climate_projections", available: true, tileLayerId: "hwm_2100s_585" },

  // ── Derived → Risk Analysis ─────────────────────────────────────────────────
  { id: "grid_flood",        name: "Flood Risk",               icon: CloudRain, color: "#3b82f6", source: "geojson", group: "analysis",       available: true },
  { id: "grid_heat",         name: "Heat Risk",                icon: Flame,     color: "#ef4444", source: "geojson", group: "analysis",       available: true },
  { id: "grid_landslide",    name: "Landslide Risk",           icon: Mountain,  color: "#a16207", source: "geojson", group: "analysis",       available: true },

  // ── Derived → Base Layers ───────────────────────────────────────────────────
  { id: "rivers",            name: "Rivers",                   icon: Droplets,      color: "#06b6d4", source: "geojson", group: "base_layers", available: true },

  // ── Derived → Climate Sites ─────────────────────────────────────────────────
  { id: "sites_parks",       name: "Parks & Green Space",      icon: Trees,         color: "#22c55e", source: "geojson", group: "sites",       available: true },
  { id: "sites_schools",     name: "Schools & Education",      icon: GraduationCap, color: "#f59e0b", source: "geojson", group: "sites",       available: true },
  { id: "sites_hospitals",   name: "Hospitals & Health",       icon: Heart,         color: "#ef4444", source: "geojson", group: "sites",       available: true },
  { id: "sites_wetlands",    name: "Wetlands",                 icon: Waves,         color: "#3b82f6", source: "geojson", group: "sites",       available: true },
  { id: "sites_sports",      name: "Sports Grounds & Plazas",  icon: Dumbbell,      color: "#8b5cf6", source: "geojson", group: "sites",       available: true },
  { id: "sites_social",      name: "Community Facilities",     icon: HandHeart,     color: "#ec4899", source: "geojson", group: "sites",       available: true },
  { id: "sites_vacant",      name: "Vacant & Brownfield Land", icon: MapIcon,       color: "#a16207", source: "geojson", group: "sites",       available: true },
  { id: "sites_flood_zones", name: "Flood Risk Zones (OSM)",     icon: Waves,         color: "#1d4ed8", source: "geojson", group: "sites",       available: true },
  { id: "sites_flood2024",   name: "2024 Flood Extent (Planet/SkySat)", icon: CloudRain, color: "#60a5fa", source: "geojson", group: "sites", available: true },
  { id: "ref_viirs_lst",     name: "Heat Intensity (VIIRS 375m)",icon: Flame,        color: "#f97316", source: "tiles",   group: "sites",       available: true, tileLayerId: "viirs_i5_day" },
];

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
} from "lucide-react";

export type LayerSource = "geojson" | "tiles";
export type LayerSection = "oef_catalog" | "derived";
export type LayerGroup =
  | "oef_environment"
  | "transport"
  | "social"
  | "oef_tiles"
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
  { id: "oef_environment", label: "Environment",              section: "oef_catalog" },
  { id: "transport",       label: "Transport",                section: "oef_catalog" },
  { id: "social",          label: "Social & Demographics",    section: "oef_catalog" },
  { id: "oef_tiles",       label: "Geospatial Layers",        section: "oef_catalog" },
  { id: "analysis",        label: "Risk Analysis",            section: "derived"     },
  { id: "base_layers",     label: "Base Layers",              section: "derived"     },
  { id: "sites",           label: "Climate Sites",            section: "derived"     },
];

export const LAYER_CONFIGS: LayerConfig[] = [
  // ── OEF Catalog → Environment ──────────────────────────────────────────────
  { id: "solar_potential",   name: "Solar Potential",          icon: Sun,       color: "#f59e0b", source: "geojson", group: "oef_environment", available: true },

  // ── OEF Catalog → Transport ────────────────────────────────────────────────
  { id: "transit_routes",    name: "Bus Routes",               icon: Bus,       color: "#06b6d4", source: "geojson", group: "transport",       available: true },
  { id: "transit_stops",     name: "Bus Stops",                icon: MapPin,    color: "#14b8a6", source: "geojson", group: "transport",       available: true },

  // ── OEF Catalog → Social & Demographics ────────────────────────────────────
  { id: "ibge_census",       name: "Census Indicators",        icon: BarChart3, color: "#a855f7", source: "geojson", group: "social",          available: true },
  { id: "ibge_settlements",  name: "Informal Settlements",     icon: Home,      color: "#f43f5e", source: "geojson", group: "social",          available: true },

  // ── OEF Catalog → Geospatial Layers (tiles) ────────────────────────────────
  { id: "oef_dynamic_world",    name: "Land Use (Dynamic World)", icon: Grid3X3,     color: "#06d6a0", source: "tiles",   group: "oef_tiles",    available: true,  tileLayerId: "dynamic_world" },
  { id: "oef_solar_tiles",      name: "Solar PV Tiles",           icon: Sun,         color: "#eab308", source: "tiles",   group: "oef_tiles",    available: true,  tileLayerId: "solar_pvout" },
  { id: "oef_slope",            name: "Slope",                    icon: Mountain,    color: "#bc6c25", source: "tiles",   group: "oef_tiles",    available: false },
  { id: "oef_flow_accumulation",name: "Flow Accumulation",        icon: Droplets,    color: "#0077b6", source: "tiles",   group: "oef_tiles",    available: false },
  { id: "oef_canopy_cover",     name: "Canopy Cover",             icon: Trees,       color: "#588157", source: "tiles",   group: "oef_tiles",    available: false },
  { id: "oef_flood_hazard",     name: "Flood Hazard",             icon: CloudRain,   color: "#023e8a", source: "tiles",   group: "oef_tiles",    available: false },
  { id: "oef_heat_hazard",      name: "Heat Hazard",              icon: Flame,       color: "#d00000", source: "tiles",   group: "oef_tiles",    available: false },
  { id: "oef_exposure",         name: "Exposure Score",           icon: Users,       color: "#7b2cbf", source: "tiles",   group: "oef_tiles",    available: false },
  { id: "oef_cooling",          name: "Cooling Capacity",         icon: Leaf,        color: "#2d6a4f", source: "tiles",   group: "oef_tiles",    available: false },
  { id: "oef_composite_risk",   name: "Composite Risk",           icon: AlertTriangle,color: "#e63946",source: "tiles",   group: "oef_tiles",    available: false },
  { id: "oef_opportunity_zones",name: "NbS Opportunity Zones",   icon: MapPinned,   color: "#06d6a0", source: "tiles",   group: "oef_tiles",    available: false },

  // ── Derived → Risk Analysis ─────────────────────────────────────────────────
  { id: "grid_flood",        name: "Flood Risk",               icon: CloudRain, color: "#3b82f6", source: "geojson", group: "analysis",       available: true },
  { id: "grid_heat",         name: "Heat Risk",                icon: Flame,     color: "#ef4444", source: "geojson", group: "analysis",       available: true },
  { id: "grid_landslide",    name: "Landslide Risk",           icon: Mountain,  color: "#a16207", source: "geojson", group: "analysis",       available: true },
  { id: "grid_population",   name: "Population Density",       icon: Users,     color: "#8b5cf6", source: "geojson", group: "analysis",       available: true },
  { id: "grid_buildings",    name: "Building Density",         icon: Building2, color: "#f97316", source: "geojson", group: "analysis",       available: true },

  // ── Derived → Base Layers ───────────────────────────────────────────────────
  { id: "elevation",         name: "Elevation",                icon: Mountain,      color: "#c9a87c", source: "geojson", group: "base_layers", available: true },
  { id: "landcover",         name: "Land Cover",               icon: MapIcon,       color: "#4ade80", source: "geojson", group: "base_layers", available: true },
  { id: "surface_water",     name: "Water Bodies",             icon: Droplets,      color: "#3b82f6", source: "geojson", group: "base_layers", available: true },
  { id: "rivers",            name: "Rivers",                   icon: Droplets,      color: "#06b6d4", source: "geojson", group: "base_layers", available: true },
  { id: "forest",            name: "Forest",                   icon: Trees,         color: "#22c55e", source: "geojson", group: "base_layers", available: true },

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

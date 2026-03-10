import {
  MapPinned,
  CloudRain,
  Flame,
  Mountain,
  Users,
  Building2,
  Droplets,
  Trees,
  Map as MapIcon,
  Grid3X3,
  Leaf,
  AlertTriangle,
} from "lucide-react";

export type LayerSource = "geojson" | "tiles";
export type LayerGroup = "analysis" | "environment" | "oef";

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

export const LAYER_CONFIGS: LayerConfig[] = [
  { id: "intervention_zones", name: "Intervention Zones", icon: MapPinned, color: "#10b981", source: "geojson", group: "analysis", available: true },
  { id: "grid_flood", name: "Flood Risk", icon: CloudRain, color: "#3b82f6", source: "geojson", group: "analysis", available: true },
  { id: "grid_heat", name: "Heat Risk", icon: Flame, color: "#ef4444", source: "geojson", group: "analysis", available: true },
  { id: "grid_landslide", name: "Landslide Risk", icon: Mountain, color: "#a16207", source: "geojson", group: "analysis", available: true },
  { id: "grid_population", name: "Population Density", icon: Users, color: "#8b5cf6", source: "geojson", group: "analysis", available: true },
  { id: "grid_buildings", name: "Building Density", icon: Building2, color: "#f97316", source: "geojson", group: "analysis", available: true },

  { id: "elevation", name: "Elevation", icon: Mountain, color: "#c9a87c", source: "geojson", group: "environment", available: true },
  { id: "landcover", name: "Land Cover", icon: MapIcon, color: "#4ade80", source: "geojson", group: "environment", available: true },
  { id: "surface_water", name: "Water Bodies", icon: Droplets, color: "#3b82f6", source: "geojson", group: "environment", available: true },
  { id: "rivers", name: "Rivers", icon: Droplets, color: "#06b6d4", source: "geojson", group: "environment", available: true },
  { id: "forest", name: "Forest", icon: Trees, color: "#22c55e", source: "geojson", group: "environment", available: true },

  { id: "oef_dynamic_world", name: "Land Use (Dynamic World)", icon: Grid3X3, color: "#06d6a0", source: "tiles", group: "oef", available: true, tileLayerId: "dynamic_world" },
  { id: "oef_slope", name: "Slope", icon: Mountain, color: "#bc6c25", source: "tiles", group: "oef", available: false },
  { id: "oef_flow_accumulation", name: "Flow Accumulation", icon: Droplets, color: "#0077b6", source: "tiles", group: "oef", available: false },
  { id: "oef_canopy_cover", name: "Canopy Cover", icon: Trees, color: "#588157", source: "tiles", group: "oef", available: false },
  { id: "oef_flood_hazard", name: "Flood Hazard", icon: CloudRain, color: "#023e8a", source: "tiles", group: "oef", available: false },
  { id: "oef_heat_hazard", name: "Heat Hazard", icon: Flame, color: "#d00000", source: "tiles", group: "oef", available: false },
  { id: "oef_exposure", name: "Exposure Score", icon: Users, color: "#7b2cbf", source: "tiles", group: "oef", available: false },
  { id: "oef_cooling", name: "Cooling Capacity", icon: Leaf, color: "#2d6a4f", source: "tiles", group: "oef", available: false },
  { id: "oef_composite_risk", name: "Composite Risk", icon: AlertTriangle, color: "#e63946", source: "tiles", group: "oef", available: false },
  { id: "oef_opportunity_zones", name: "NbS Opportunity Zones", icon: MapPinned, color: "#06d6a0", source: "tiles", group: "oef", available: false },
];

export const LAYER_GROUPS = [
  { id: "analysis" as const, label: "Risk Analysis" },
  { id: "environment" as const, label: "Environment" },
  { id: "oef" as const, label: "OEF Geospatial Data" },
];

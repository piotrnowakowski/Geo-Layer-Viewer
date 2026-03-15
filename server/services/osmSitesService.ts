import type { GeoBounds } from "@shared/schema";
import { queryOverpass, toBbox } from "./overpassHelper";

export interface SiteLayerConfig {
  layerId: string;
  label: string;
  color: string;
  osmTags: string[];
  climateRelevance: string;
}

export const SITE_LAYER_CONFIGS: SiteLayerConfig[] = [
  {
    layerId: "sites_parks",
    label: "Parks & Green Space",
    color: "#22c55e",
    osmTags: ["leisure=park", "leisure=garden", "leisure=nature_reserve", "landuse=recreation_ground"],
    climateRelevance: "Cooling islands, NbS opportunity zones, stormwater retention",
  },
  {
    layerId: "sites_schools",
    label: "Schools & Education",
    color: "#f59e0b",
    osmTags: ["amenity=school", "amenity=kindergarten", "amenity=university", "amenity=college"],
    climateRelevance: "High occupancy during heat waves, NbS implementation sites",
  },
  {
    layerId: "sites_hospitals",
    label: "Hospitals & Health",
    color: "#ef4444",
    osmTags: ["amenity=hospital", "amenity=clinic", "amenity=doctors", "healthcare=hospital"],
    climateRelevance: "Critical infrastructure — heat stress, flood vulnerability, evacuation planning",
  },
  {
    layerId: "sites_wetlands",
    label: "Wetlands",
    color: "#3b82f6",
    osmTags: ["natural=wetland", "water=lagoon", "landuse=wetland"],
    climateRelevance: "Flood attenuation, biodiversity corridors, water regulation",
  },
  {
    layerId: "sites_sports",
    label: "Sports Grounds & Plazas",
    color: "#8b5cf6",
    osmTags: ["leisure=sports_pitch", "leisure=stadium", "leisure=sports_centre", "highway=pedestrian", "place=square"],
    climateRelevance: "Retrofittable for detention/retention, permeable surface opportunity",
  },
  {
    layerId: "sites_social",
    label: "Community Facilities",
    color: "#ec4899",
    osmTags: ["amenity=community_centre", "amenity=social_facility", "amenity=shelter", "amenity=place_of_worship"],
    climateRelevance: "Vulnerable population clusters, evacuation centres, heat refuges",
  },
  {
    layerId: "sites_vacant",
    label: "Vacant & Brownfield Land",
    color: "#a16207",
    osmTags: ["landuse=brownfield", "landuse=vacant", "landuse=abandoned"],
    climateRelevance: "Priority sites for NbS intervention — permeable surface, urban greening, stormwater retention",
  },
];

function buildOverpassQuery(osmTags: string[], bbox: string): string {
  const lines: string[] = [];
  for (const tag of osmTags) {
    const [key, value] = tag.split("=");
    lines.push(`  node["${key}"="${value}"](${bbox});`);
    lines.push(`  way["${key}"="${value}"](${bbox});`);
    lines.push(`  relation["${key}"="${value}"](${bbox});`);
  }
  return `
[out:json][timeout:90][maxsize:104857600];
(
${lines.join("\n")}
);
out body;
>;
out skel qt;
  `.trim();
}

export async function fetchSiteLayer(
  layerId: string,
  bounds: GeoBounds
): Promise<any> {
  const config = SITE_LAYER_CONFIGS.find((c) => c.layerId === layerId);
  if (!config) throw new Error(`Unknown site layer: ${layerId}`);

  const bbox = toBbox(bounds);
  const query = buildOverpassQuery(config.osmTags, bbox);

  const osmData = await queryOverpass(query);
  const osmtogeojson = (await import("osmtogeojson")).default;
  const geoJson = osmtogeojson(osmData);

  return {
    layerId,
    label: config.label,
    color: config.color,
    featureCount: geoJson.features.length,
    geoJson,
  };
}

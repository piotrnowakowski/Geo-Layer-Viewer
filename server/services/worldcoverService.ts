import type { GeoBounds, LandcoverData } from "@shared/schema";
import { queryOverpass, reduceBox, toBbox } from "./overpassHelper";

export async function getLandcoverData(
  cityLocode: string,
  bounds: GeoBounds
): Promise<LandcoverData> {
  const reduced = reduceBox(bounds, 0.25);
  const bbox = toBbox(reduced);

  const query = `
    [out:json][timeout:90];
    (
      way["landuse"](${bbox});
      way["natural"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  const osmData = await queryOverpass(query);
  const osmtogeojson = (await import("osmtogeojson")).default;
  const geoJson = osmtogeojson(osmData);

  const classes = {
    builtUp: 0, trees: 0, shrubland: 0, grassland: 0,
    cropland: 0, bareVegetation: 0, water: 0, wetland: 0,
    mangroves: 0, moss: 0, snowIce: 0,
  };

  const LANDUSE_MAP: Record<string, keyof typeof classes> = {
    residential: "builtUp", commercial: "builtUp", industrial: "builtUp",
    retail: "builtUp", construction: "builtUp",
    forest: "trees", wood: "trees",
    scrub: "shrubland", heath: "shrubland",
    grass: "grassland", meadow: "grassland", recreation_ground: "grassland",
    farmland: "cropland", orchard: "cropland", vineyard: "cropland",
    bare_rock: "bareVegetation", sand: "bareVegetation",
    water: "water", reservoir: "water",
    wetland: "wetland", marsh: "wetland",
  };

  for (const feature of geoJson.features) {
    const landuse = feature.properties?.landuse || feature.properties?.natural;
    if (landuse) {
      const classKey = LANDUSE_MAP[landuse];
      if (classKey) {
        classes[classKey]++;
      }
      feature.properties.landcover_class = classKey || landuse;
    }
  }

  return {
    cityLocode,
    bounds: reduced,
    classes,
    geoJson,
  };
}

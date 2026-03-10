import type { GeoBounds, ForestData } from "@shared/schema";
import { queryOverpass, reduceBox, toBbox } from "./overpassHelper";

export async function getForestCanopyData(
  cityLocode: string,
  bounds: GeoBounds
): Promise<ForestData> {
  const reduced = reduceBox(bounds, 0.15);
  const bbox = toBbox(reduced);

  const query = `
    [out:json][timeout:90];
    (
      way["natural"="wood"](${bbox});
      way["landuse"="forest"](${bbox});
      relation["natural"="wood"](${bbox});
      relation["landuse"="forest"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  const osmData = await queryOverpass(query);
  const osmtogeojson = (await import("osmtogeojson")).default;
  const geoJson = osmtogeojson(osmData);

  const areas: number[] = [];
  for (const feature of geoJson.features) {
    if (feature.properties?.area) {
      areas.push(Number(feature.properties.area));
    }
  }

  const mean = areas.length ? areas.reduce((a, b) => a + b, 0) / areas.length : 0;
  const min = areas.length ? Math.min(...areas) : 0;
  const max = areas.length ? Math.max(...areas) : 0;

  return {
    canopyCover: { mean, min, max },
    geoJson,
  };
}

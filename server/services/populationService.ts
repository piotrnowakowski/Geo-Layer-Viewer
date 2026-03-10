import type { GeoBounds, PopulationData } from "@shared/schema";
import { queryOverpass, reduceBox, toBbox } from "./overpassHelper";

export async function getPopulationData(
  cityLocode: string,
  bounds: GeoBounds
): Promise<PopulationData> {
  const reduced = reduceBox(bounds, 0.2);
  const bbox = toBbox(reduced);

  const query = `
    [out:json][timeout:90];
    (
      way["landuse"="residential"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  const osmData = await queryOverpass(query);
  const osmtogeojson = (await import("osmtogeojson")).default;
  const geoJson = osmtogeojson(osmData);

  return { geoJson };
}

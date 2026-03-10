import type { GeoBounds, SurfaceWaterData } from "@shared/schema";
import { queryOverpass, reduceBox, toBbox } from "./overpassHelper";

export async function getSurfaceWaterData(
  cityLocode: string,
  bounds: GeoBounds
): Promise<SurfaceWaterData> {
  const reduced = reduceBox(bounds, 0.15);
  const bbox = toBbox(reduced);

  const query = `
    [out:json][timeout:90];
    (
      way["natural"="water"](${bbox});
      relation["natural"="water"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  const osmData = await queryOverpass(query);
  const osmtogeojson = (await import("osmtogeojson")).default;
  const geoJson = osmtogeojson(osmData);

  let permanent = 0;
  let seasonal = 0;

  for (const feature of geoJson.features) {
    const intermittent = feature.properties?.intermittent;
    if (intermittent === "yes") {
      seasonal++;
    } else {
      permanent++;
    }
  }

  return {
    occurrence: { permanent, seasonal },
    geoJson,
  };
}

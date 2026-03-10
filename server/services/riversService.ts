import type { GeoBounds, RiversData } from "@shared/schema";
import { queryOverpass, reduceBox, toBbox } from "./overpassHelper";

export async function getRiversData(
  cityLocode: string,
  bounds: GeoBounds
): Promise<RiversData> {
  const reduced = reduceBox(bounds, 0.15);
  const bbox = toBbox(reduced);

  const query = `
    [out:json][timeout:90];
    (
      way["waterway"="river"](${bbox});
      way["waterway"="stream"](${bbox});
      way["waterway"="canal"](${bbox});
      relation["waterway"="river"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  const osmData = await queryOverpass(query);
  const osmtogeojson = (await import("osmtogeojson")).default;
  const geoJson = osmtogeojson(osmData);

  const majorRivers: string[] = [];
  let totalLengthKm = 0;

  for (const feature of geoJson.features) {
    const name = feature.properties?.name;
    if (name && !majorRivers.includes(name)) {
      majorRivers.push(name);
    }
    if (feature.geometry?.type === "LineString" && feature.geometry.coordinates) {
      const coords = feature.geometry.coordinates;
      for (let i = 1; i < coords.length; i++) {
        totalLengthKm += haversineDistance(
          coords[i - 1][1], coords[i - 1][0],
          coords[i][1], coords[i][0]
        );
      }
    }
  }

  return {
    majorRivers,
    totalLengthKm: Math.round(totalLengthKm * 100) / 100,
    geoJson,
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

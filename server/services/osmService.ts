import type { BoundaryData, GeoBounds } from "@shared/schema";

const USER_AGENT = "NbS-Map-Visualizer/1.0 (https://replit.com)";

export async function getCityBoundary(
  cityName: string,
  cityLocode: string
): Promise<BoundaryData> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&polygon_geojson=1&limit=1`;

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Nominatim API error: ${response.status}`);
  }

  const results = await response.json();
  if (!results.length) {
    throw new Error(`No results found for "${cityName}"`);
  }

  const result = results[0];
  const bbox = result.boundingbox.map(Number) as [number, number, number, number];

  const boundaryGeoJson =
    result.geojson?.type === "Polygon" || result.geojson?.type === "MultiPolygon"
      ? {
          type: "Feature" as const,
          properties: { name: cityName, locode: cityLocode },
          geometry: result.geojson,
        }
      : null;

  return {
    cityLocode,
    cityName,
    centroid: [Number(result.lat), Number(result.lon)],
    bbox: [bbox[0], bbox[2], bbox[1], bbox[3]],
    boundaryGeoJson,
  };
}

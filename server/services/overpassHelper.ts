import type { GeoBounds } from "@shared/schema";

const MAX_RETRIES = 2;
const RETRY_DELAY = 3000;
const OVERPASS_TIMEOUT = 90;

export async function queryOverpass(query: string, retries = MAX_RETRIES): Promise<any> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (let attempt = 0; attempt <= retries; attempt++) {
    const endpoint = endpoints[attempt % endpoints.length];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return await response.json();
      }

      console.log(`Overpass attempt ${attempt + 1} failed with status ${response.status}, retrying...`);
    } catch (err: any) {
      console.log(`Overpass attempt ${attempt + 1} error: ${err.message}, retrying...`);
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (attempt + 1)));
    }
  }

  throw new Error("All Overpass API attempts failed");
}

export function reduceBox(bounds: GeoBounds, factor: number = 0.3): GeoBounds {
  const latRange = bounds.maxLat - bounds.minLat;
  const lngRange = bounds.maxLng - bounds.minLng;
  const latPad = latRange * factor;
  const lngPad = lngRange * factor;
  return {
    minLat: bounds.minLat + latPad,
    minLng: bounds.minLng + lngPad,
    maxLat: bounds.maxLat - latPad,
    maxLng: bounds.maxLng - lngPad,
  };
}

export function toBbox(bounds: GeoBounds): string {
  return `${bounds.minLat},${bounds.minLng},${bounds.maxLat},${bounds.maxLng}`;
}

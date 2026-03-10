import type { GeoBounds } from "@shared/schema";
import { queryOverpass, reduceBox, toBbox } from "./overpassHelper";

interface BuildingCentroid {
  lat: number;
  lng: number;
}

export interface BuildingData {
  centroids: BuildingCentroid[];
  totalBuildings: number;
  queriedBounds: GeoBounds;
}

async function queryBuildingsChunk(bounds: GeoBounds): Promise<BuildingCentroid[]> {
  const bbox = toBbox(bounds);
  const query = `
    [out:json][timeout:90];
    way["building"](${bbox});
    out center;
  `;

  const osmData = await queryOverpass(query);
  const centroids: BuildingCentroid[] = [];

  for (const el of osmData.elements) {
    if (el.type === "way" && el.tags?.building && el.center) {
      centroids.push({
        lat: el.center.lat,
        lng: el.center.lon,
      });
    }
  }

  return centroids;
}

function splitBoundsGrid(bounds: GeoBounds, rows: number, cols: number): GeoBounds[] {
  const latStep = (bounds.maxLat - bounds.minLat) / rows;
  const lngStep = (bounds.maxLng - bounds.minLng) / cols;
  const chunks: GeoBounds[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      chunks.push({
        minLat: bounds.minLat + r * latStep,
        minLng: bounds.minLng + c * lngStep,
        maxLat: bounds.minLat + (r + 1) * latStep,
        maxLng: bounds.minLng + (c + 1) * lngStep,
      });
    }
  }
  return chunks;
}

export async function getBuildingData(
  cityLocode: string,
  bounds: GeoBounds
): Promise<BuildingData> {
  const reduced = reduceBox(bounds, 0.25);

  const chunks = splitBoundsGrid(reduced, 4, 4);
  const allCentroids: BuildingCentroid[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Fetching buildings chunk ${i + 1}/${chunks.length}...`);
    try {
      const chunkCentroids = await queryBuildingsChunk(chunks[i]);
      allCentroids.push(...chunkCentroids);
      console.log(`    Got ${chunkCentroids.length} buildings (total: ${allCentroids.length})`);
    } catch (err: any) {
      console.log(`    Chunk ${i + 1} failed: ${err.message} (continuing)`);
    }

    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log(`  Total real building footprints: ${allCentroids.length}`);

  return {
    centroids: allCentroids,
    totalBuildings: allCentroids.length,
    queriedBounds: reduced,
  };
}

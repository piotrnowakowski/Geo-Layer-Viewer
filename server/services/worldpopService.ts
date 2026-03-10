import type { GeoBounds } from "@shared/schema";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const WORLDPOP_URL =
  "https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/2020/BSGM/BRA/bra_ppp_2020_constrained.tif";

const CACHE_DIR = path.join(process.cwd(), "client", "public", "sample-data");
const TIFF_CACHE = path.join(CACHE_DIR, "worldpop_bra_2020.tif");

export interface PopulationData {
  bounds: GeoBounds;
  resolution: number;
  samples: { lat: number; lng: number; pop: number }[];
  totalPopulation: number;
}

async function ensureWorldPopTiff(): Promise<string> {
  if (fs.existsSync(TIFF_CACHE)) {
    const stats = fs.statSync(TIFF_CACHE);
    if (stats.size > 100_000_000) {
      console.log(`WorldPop GeoTIFF already cached (${(stats.size / 1024 / 1024).toFixed(0)} MB)`);
      return TIFF_CACHE;
    }
    fs.unlinkSync(TIFF_CACHE);
  }

  console.log("Downloading WorldPop Brazil GeoTIFF (~131MB) via wget...");
  execSync(`wget -q -O "${TIFF_CACHE}" "${WORLDPOP_URL}"`, {
    timeout: 300_000,
    stdio: "inherit",
  });

  const stats = fs.statSync(TIFF_CACHE);
  console.log(`WorldPop GeoTIFF saved: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  return TIFF_CACHE;
}

export async function getPopulationData(
  bounds: GeoBounds
): Promise<PopulationData> {
  const tiffPath = await ensureWorldPopTiff();

  const { fromFile } = await import("geotiff");
  const tiff = await fromFile(tiffPath);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const origin = image.getOrigin();
  const res = image.getResolution();

  console.log(
    `WorldPop raster: ${width}x${height}, origin=[${origin[0].toFixed(4)},${origin[1].toFixed(4)}], res=[${res[0].toFixed(6)},${res[1].toFixed(6)}]`
  );

  const col0 = Math.max(0, Math.floor((bounds.minLng - origin[0]) / res[0]));
  const col1 = Math.min(width - 1, Math.ceil((bounds.maxLng - origin[0]) / res[0]));
  const row0 = Math.max(0, Math.floor((bounds.maxLat - origin[1]) / res[1]));
  const row1 = Math.min(height - 1, Math.ceil((bounds.minLat - origin[1]) / res[1]));

  const windowWidth = col1 - col0 + 1;
  const windowHeight = row1 - row0 + 1;

  console.log(
    `Reading window: cols[${col0}-${col1}] rows[${row0}-${row1}] (${windowWidth}x${windowHeight} pixels)`
  );

  const rasters = await image.readRasters({
    window: [col0, row0, col1 + 1, row1 + 1],
  });

  const data = rasters[0] as Float32Array | Float64Array;
  const samples: { lat: number; lng: number; pop: number }[] = [];
  let totalPop = 0;

  for (let r = 0; r < windowHeight; r++) {
    for (let c = 0; c < windowWidth; c++) {
      const val = data[r * windowWidth + c];
      if (val > 0 && isFinite(val) && val < 1e6) {
        const lng = origin[0] + (col0 + c + 0.5) * res[0];
        const lat = origin[1] + (row0 + r + 0.5) * res[1];
        samples.push({ lat, lng, pop: Math.round(val * 100) / 100 });
        totalPop += val;
      }
    }
  }

  console.log(
    `WorldPop: ${samples.length} populated pixels, total population ~${Math.round(totalPop).toLocaleString()}`
  );

  return {
    bounds,
    resolution: Math.abs(res[0]),
    samples,
    totalPopulation: Math.round(totalPop),
  };
}

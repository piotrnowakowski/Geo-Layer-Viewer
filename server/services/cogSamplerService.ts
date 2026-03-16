/**
 * COG Sampler Service
 *
 * Raster dataset access for Porto Alegre spatial analysis.
 * Downloads and caches raster windows in server memory; sampling is then instant.
 *
 * Datasets:
 *   Hansen GFC 2023 v1.11  — lossyear, treecover2000 (GCS public)
 *   JRC GSW v1.3 2020      — occurrence, seasonality (Azure Blob via PC SAS sign)
 *   MODIS MYD13Q1 v061     — NDVI 250 m (Azure Blob via PC SAS sign + STAC query)
 */

import path from "path";
import fs from "fs";

// ── Porto Alegre analysis bounds ───────────────────────────────────────────
// Hansen and JRC tiles have their north edge at -30°S so ymin is always 0
// for Porto Alegre (city centre ≈ -30.03°S to -30.25°S, 51.18°W to 51.10°W)
const PA_BOUNDS = {
  minLat: -30.4,
  maxLat: -29.95,
  minLng: -51.4,
  maxLng: -51.0,
};

// Disk cache for downloaded rasters (survive minor restarts in dev)
const RASTER_CACHE_DIR = path.resolve(process.cwd(), ".raster-cache");
if (!fs.existsSync(RASTER_CACHE_DIR)) {
  fs.mkdirSync(RASTER_CACHE_DIR, { recursive: true });
}

// ── Planetary Computer signed URL helper ──────────────────────────────────
const _signedUrlCache = new Map<string, { href: string; expiry: Date }>();

async function getSignedUrl(blobUrl: string): Promise<string> {
  const cached = _signedUrlCache.get(blobUrl);
  if (cached && cached.expiry > new Date(Date.now() + 5 * 60 * 1000)) {
    return cached.href;
  }
  const res = await fetch(
    `https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=${encodeURIComponent(blobUrl)}`
  );
  if (!res.ok) throw new Error(`PC sign request failed: ${res.status}`);
  const body = await res.json();
  const href: string = body.href;
  const expiry = new Date(body["msft:expiry"] as string);
  _signedUrlCache.set(blobUrl, { href, expiry });
  return href;
}

// ── MODIS latest NDVI URL (queried from STAC, cached 12 h) ────────────────
let _modisNdviCache: { blobUrl: string; fetched: number } | null = null;

async function getModisNdviBlobUrl(): Promise<string> {
  const TWELVE_HOURS = 12 * 3600 * 1000;
  if (_modisNdviCache && Date.now() - _modisNdviCache.fetched < TWELVE_HOURS) {
    return _modisNdviCache.blobUrl;
  }
  const stacRes = await fetch(
    "https://planetarycomputer.microsoft.com/api/stac/v1/collections/modis-13Q1-061/items" +
      "?bbox=-52,-31,-50,-29&limit=10"
  );
  if (!stacRes.ok) throw new Error(`STAC query failed: ${stacRes.status}`);
  const stacData = await stacRes.json();
  const item =
    stacData.features.find((f: any) => f.id.includes("h13v12") && f.id.startsWith("MYD")) ??
    stacData.features.find((f: any) => f.id.includes("h13v12"));
  if (!item) throw new Error("No MODIS NDVI item found for tile h13v12 in STAC");
  const ndviAsset = item.assets?.["250m_16_days_NDVI"];
  if (!ndviAsset?.href) throw new Error("MODIS item missing 250m_16_days_NDVI asset");
  _modisNdviCache = { blobUrl: ndviAsset.href as string, fetched: Date.now() };
  return _modisNdviCache.blobUrl;
}

// ── Raster window memory cache ─────────────────────────────────────────────
interface RasterWindow {
  data: Float32Array;
  width: number;
  height: number;
  xmin: number;
  ymin: number;
  originX: number;
  originY: number;
  resX: number;
  resY: number;
  isSinusoidal: boolean;
}
const _windowCache = new Map<string, RasterWindow>();
const _loadingSet = new Set<string>();

// MODIS sinusoidal sphere radius
const MODIS_R = 6371007.181;

function lngLatToSinu(lng: number, lat: number): [number, number] {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  return [MODIS_R * λ * Math.cos(φ), MODIS_R * φ];
}

async function loadRasterWindow(
  datasetId: string,
  downloadUrl: string,
  noData: number,
  ndviScale: boolean
): Promise<RasterWindow> {
  const cached = _windowCache.get(datasetId);
  if (cached) return cached;

  if (_loadingSet.has(datasetId)) {
    // Wait for the in-progress download to complete
    await new Promise<void>((resolve, reject) => {
      const interval = setInterval(() => {
        if (!_loadingSet.has(datasetId)) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for ${datasetId} to load`));
      }, 120000);
    });
    const w = _windowCache.get(datasetId);
    if (w) return w;
    throw new Error(`Dataset ${datasetId} failed to load`);
  }

  _loadingSet.add(datasetId);
  try {
    const { fromArrayBuffer } = await import("geotiff");

    console.log(`[cogSampler] Downloading ${datasetId}...`);
    const t0 = Date.now();
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} downloading ${datasetId}`);
    }
    const buffer = await response.arrayBuffer();
    console.log(
      `[cogSampler] ${datasetId}: ${(buffer.byteLength / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`
    );

    const tiff = await fromArrayBuffer(buffer);
    const image = await tiff.getImage();

    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const originX = origin[0];
    const originY = origin[1];
    const resX = Math.abs(resolution[0]);
    const resY = Math.abs(resolution[1]);
    const imgWidth = image.getWidth();
    const imgHeight = image.getHeight();

    // Detect sinusoidal projection (MODIS): origin values are in metres, not degrees
    const isSinusoidal = Math.abs(originX) > 1e6 || Math.abs(originY) > 1e6;

    let xmin: number, ymin: number, xmax: number, ymax: number;
    if (isSinusoidal) {
      const [swX, swY] = lngLatToSinu(PA_BOUNDS.minLng, PA_BOUNDS.minLat);
      const [neX, neY] = lngLatToSinu(PA_BOUNDS.maxLng, PA_BOUNDS.maxLat);
      xmin = Math.max(0, Math.floor((Math.min(swX, neX) - originX) / resX));
      xmax = Math.min(imgWidth, Math.ceil((Math.max(swX, neX) - originX) / resX));
      ymin = Math.max(0, Math.floor((originY - Math.max(swY, neY)) / resY));
      ymax = Math.min(imgHeight, Math.ceil((originY - Math.min(swY, neY)) / resY));
    } else {
      xmin = Math.max(0, Math.floor((PA_BOUNDS.minLng - originX) / resX));
      xmax = Math.min(imgWidth, Math.ceil((PA_BOUNDS.maxLng - originX) / resX));
      ymin = Math.max(0, Math.floor((originY - PA_BOUNDS.maxLat) / resY));
      ymax = Math.min(imgHeight, Math.ceil((originY - PA_BOUNDS.minLat) / resY));
    }

    if (xmin >= xmax || ymin >= ymax) {
      throw new Error(
        `${datasetId}: Porto Alegre bounds do not overlap tile. ` +
          `Origin=(${originX.toFixed(4)},${originY.toFixed(4)}), ` +
          `res=(${resX.toFixed(6)},${resY.toFixed(6)}), imgSize=${imgWidth}×${imgHeight}`
      );
    }

    const t1 = Date.now();
    const [rawBand] = await image.readRasters({ window: [xmin, ymin, xmax, ymax] });
    console.log(
      `[cogSampler] ${datasetId}: window [${xmin},${ymin},${xmax},${ymax}] ` +
        `decoded in ${((Date.now() - t1) / 1000).toFixed(1)}s`
    );

    const raw = rawBand as unknown as ArrayLike<number>;
    const wWidth = xmax - xmin;
    const wHeight = ymax - ymin;
    const data = new Float32Array(wWidth * wHeight);
    for (let i = 0; i < data.length; i++) {
      const v = raw[i];
      if (v === noData || v == null) {
        data[i] = NaN;
      } else {
        data[i] = ndviScale ? (v as number) / 10000 : (v as number);
      }
    }

    const win: RasterWindow = {
      data,
      width: wWidth,
      height: wHeight,
      xmin,
      ymin,
      originX,
      originY,
      resX,
      resY,
      isSinusoidal,
    };
    _windowCache.set(datasetId, win);
    console.log(`[cogSampler] ${datasetId} ready — ${wWidth}×${wHeight} pixels cached`);
    return win;
  } finally {
    _loadingSet.delete(datasetId);
  }
}

function samplePixel(w: RasterWindow, lng: number, lat: number): number | null {
  let globalCol: number, globalRow: number;
  if (w.isSinusoidal) {
    const [sx, sy] = lngLatToSinu(lng, lat);
    globalCol = Math.floor((sx - w.originX) / w.resX);
    globalRow = Math.floor((w.originY - sy) / w.resY);
  } else {
    globalCol = Math.floor((lng - w.originX) / w.resX);
    globalRow = Math.floor((w.originY - lat) / w.resY);
  }
  const localCol = globalCol - w.xmin;
  const localRow = globalRow - w.ymin;
  if (localCol < 0 || localCol >= w.width || localRow < 0 || localRow >= w.height) {
    return null;
  }
  const val = w.data[localRow * w.width + localCol];
  return isNaN(val) ? null : val;
}

// ── Dataset registry ───────────────────────────────────────────────────────

export interface RasterDataset {
  id: string;
  name: string;
  unit: string;
  description: string;
  source: string;
  noData: number;
  ndviScale: boolean;
  getDownloadUrl: () => Promise<string>;
}

export const RASTER_DATASETS: Record<string, RasterDataset> = {
  lossyear: {
    id: "lossyear",
    name: "Forest Loss Year",
    unit: "year",
    description:
      "Year of first detectable forest loss (0 = no loss, 1 = 2001 … 23 = 2023) at 30 m resolution",
    source: "Hansen / UMD / Google / USGS / NASA — GFC 2023 v1.11",
    noData: 0,
    ndviScale: false,
    getDownloadUrl: async () =>
      "https://storage.googleapis.com/earthenginepartners-hansen/GFC-2023-v1.11/Hansen_GFC-2023-v1.11_lossyear_30S_060W.tif",
  },
  treecover2000: {
    id: "treecover2000",
    name: "Tree Cover 2000",
    unit: "%",
    description: "Percentage tree cover in year 2000 at 30 m resolution",
    source: "Hansen / UMD / Google / USGS / NASA — GFC 2023 v1.11",
    noData: 0,
    ndviScale: false,
    getDownloadUrl: async () =>
      "https://storage.googleapis.com/earthenginepartners-hansen/GFC-2023-v1.11/Hansen_GFC-2023-v1.11_treecover2000_30S_060W.tif",
  },
  jrc_occurrence: {
    id: "jrc_occurrence",
    name: "Surface Water Occurrence",
    unit: "%",
    description:
      "Percentage of time surface water was present 1984–2020 at 30 m resolution",
    source: "JRC Global Surface Water v1.3 (Pekel et al., 2016) via Microsoft Planetary Computer",
    noData: 255,
    ndviScale: false,
    getDownloadUrl: async () =>
      getSignedUrl(
        "https://ai4edataeuwest.blob.core.windows.net/jrcglobalwater/occurrence/occurrence_60W_30Sv1_3_2020cog.tif"
      ),
  },
  jrc_seasonality: {
    id: "jrc_seasonality",
    name: "Surface Water Seasonality",
    unit: "months/year",
    description: "Number of months per year surface water was present at 30 m resolution",
    source: "JRC Global Surface Water v1.3 (Pekel et al., 2016) via Microsoft Planetary Computer",
    noData: 255,
    ndviScale: false,
    getDownloadUrl: async () =>
      getSignedUrl(
        "https://ai4edataeuwest.blob.core.windows.net/jrcglobalwater/seasonality/seasonality_60W_30Sv1_3_2020cog.tif"
      ),
  },
  modis_ndvi: {
    id: "modis_ndvi",
    name: "NDVI (MODIS 250 m)",
    unit: "index",
    description:
      "16-day NDVI composite (most recent available) at 250 m — range approx. −0.2–1.0",
    source:
      "NASA MODIS Aqua MYD13Q1 v061 tile h13v12 via Microsoft Planetary Computer",
    noData: -3000,
    ndviScale: true,
    getDownloadUrl: async () => {
      const blobUrl = await getModisNdviBlobUrl();
      return getSignedUrl(blobUrl);
    },
  },
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Sample a raster dataset at a list of lon/lat points.
 * The raster window is downloaded once then cached; subsequent calls are instant.
 */
export async function sampleAtPoints(
  datasetId: string,
  points: { lng: number; lat: number }[]
): Promise<(number | null)[]> {
  const dataset = RASTER_DATASETS[datasetId];
  if (!dataset) throw new Error(`Unknown raster dataset: "${datasetId}"`);
  const downloadUrl = await dataset.getDownloadUrl();
  const win = await loadRasterWindow(datasetId, downloadUrl, dataset.noData, dataset.ndviScale);
  return points.map(({ lng, lat }) => samplePixel(win, lng, lat));
}

export function listRasterDatasets(): Omit<RasterDataset, "getDownloadUrl">[] {
  return Object.values(RASTER_DATASETS).map(
    ({ id, name, unit, description, source, noData, ndviScale }) => ({
      id,
      name,
      unit,
      description,
      source,
      noData,
      ndviScale,
      loadStatus: _windowCache.has(id) ? "ready" : _loadingSet.has(id) ? "loading" : "not_loaded",
    })
  );
}

/**
 * Pre-load high-priority datasets in the background at server startup.
 * Small Hansen lossyear (28 MB) is loaded first; others queue behind it.
 */
export function preloadRasterDatasets(): void {
  const priority = ["lossyear", "jrc_occurrence"];
  (async () => {
    for (const id of priority) {
      try {
        const dataset = RASTER_DATASETS[id];
        const url = await dataset.getDownloadUrl();
        await loadRasterWindow(id, url, dataset.noData, dataset.ndviScale);
      } catch (e: any) {
        console.warn(`[cogSampler] Preload failed for ${id}:`, e.message);
      }
    }
  })();
}

export function clearRasterCache(): void {
  _windowCache.clear();
}

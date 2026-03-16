import type { GeoBounds } from "@shared/schema";

interface DemTileInfo {
  latLabel: string;
  lonLabel: string;
  url: string;
}

function getDemTileUrls(bounds: GeoBounds): DemTileInfo[] {
  const tiles: DemTileInfo[] = [];
  const minLatFloor = Math.floor(bounds.minLat);
  const maxLatFloor = Math.floor(bounds.maxLat);
  const minLngFloor = Math.floor(bounds.minLng);
  const maxLngFloor = Math.floor(bounds.maxLng);

  for (let lat = minLatFloor; lat <= maxLatFloor; lat++) {
    for (let lng = minLngFloor; lng <= maxLngFloor; lng++) {
      const latDir = lat >= 0 ? "N" : "S";
      const lonDir = lng >= 0 ? "E" : "W";
      const latNum = String(Math.abs(lat >= 0 ? lat : lat)).padStart(2, "0");
      const lonNum = String(Math.abs(lng >= 0 ? lng : lng)).padStart(3, "0");
      const latLabel = `${latDir}${latNum}`;
      const lonLabel = `${lonDir}${lonNum}`;
      const tileName = `Copernicus_DSM_COG_10_${latLabel}_00_${lonLabel}_00_DEM`;
      const url = `https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/${tileName}/${tileName}.tif`;
      tiles.push({ latLabel, lonLabel, url });
    }
  }
  return tiles;
}

interface ParsedDemTile {
  width: number;
  height: number;
  origin: [number, number];
  pixelSize: [number, number];
  data: Float32Array | Float64Array | Int16Array | Uint16Array | number[];
  tiepoint: number[];
  scale: number[];
}

async function fetchAndParseDemTile(url: string): Promise<ParsedDemTile | null> {
  try {
    const { fromUrl } = await import("geotiff");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const tiff = await fromUrl(url, { signal: controller.signal } as any);
    clearTimeout(timeout);

    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const [data] = await image.readRasters();
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const tiePoints = (image as any).getTiePoints?.() as any[] | undefined;
    const tiepoint = tiePoints?.[0] || { x: origin[0], y: origin[1] };
    const fileDir = (image as any).getFileDirectory?.() as any;
    const scale = fileDir?.ModelPixelScale || [Math.abs(resolution[0]), Math.abs(resolution[1])];

    return {
      width,
      height,
      origin: [origin[0], origin[1]],
      pixelSize: [resolution[0], resolution[1]],
      data: data as any,
      tiepoint: [typeof tiepoint === "object" && "x" in tiepoint ? tiepoint.x : origin[0], typeof tiepoint === "object" && "y" in tiepoint ? tiepoint.y : origin[1]],
      scale: Array.isArray(scale) ? scale : [Math.abs(resolution[0]), Math.abs(resolution[1])],
    };
  } catch (error: any) {
    console.error(`Failed to fetch DEM tile ${url}: ${error.message}`);
    return null;
  }
}

function getElevationAtPoint(tiles: ParsedDemTile[], lng: number, lat: number): number {
  for (const tile of tiles) {
    const col = Math.floor((lng - tile.origin[0]) / tile.pixelSize[0]);
    const row = Math.floor((lat - tile.origin[1]) / tile.pixelSize[1]);

    if (col >= 0 && col < tile.width && row >= 0 && row < tile.height) {
      const idx = row * tile.width + col;
      const val = tile.data[idx];
      if (val !== undefined && val > -1000 && val < 9000) {
        return val;
      }
    }
  }
  return 0;
}

function generateContours(
  tiles: ParsedDemTile[],
  bounds: GeoBounds,
  contourInterval: number = 50
): any {
  const step = 0.005;
  const elevationGrid: { lng: number; lat: number; elev: number }[] = [];
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += step) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += step) {
      const elev = getElevationAtPoint(tiles, lng, lat);
      if (elev > -500) {
        elevationGrid.push({ lng, lat, elev });
        if (elev < minElev) minElev = elev;
        if (elev > maxElev) maxElev = elev;
      }
    }
  }

  const features: any[] = [];
  const contourLevels: number[] = [];
  const startLevel = Math.ceil(minElev / contourInterval) * contourInterval;
  for (let level = startLevel; level <= maxElev; level += contourInterval) {
    contourLevels.push(level);
  }

  const cols = Math.ceil((bounds.maxLng - bounds.minLng) / step);
  const rows = Math.ceil((bounds.maxLat - bounds.minLat) / step);

  for (const level of contourLevels) {
    const segments: [number, number][][] = [];

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const idx00 = r * cols + c;
        const idx10 = r * cols + (c + 1);
        const idx01 = (r + 1) * cols + c;
        const idx11 = (r + 1) * cols + (c + 1);

        if (idx00 >= elevationGrid.length || idx10 >= elevationGrid.length ||
            idx01 >= elevationGrid.length || idx11 >= elevationGrid.length) continue;

        const e00 = elevationGrid[idx00].elev;
        const e10 = elevationGrid[idx10].elev;
        const e01 = elevationGrid[idx01].elev;
        const e11 = elevationGrid[idx11].elev;

        const lng0 = elevationGrid[idx00].lng;
        const lat0 = elevationGrid[idx00].lat;
        const lng1 = elevationGrid[idx10].lng;
        const lat1 = elevationGrid[idx01].lat;

        const cellCase =
          (e00 >= level ? 8 : 0) |
          (e10 >= level ? 4 : 0) |
          (e11 >= level ? 2 : 0) |
          (e01 >= level ? 1 : 0);

        if (cellCase === 0 || cellCase === 15) continue;

        const points: [number, number][] = [];

        const interpLng = (ea: number, eb: number, lngA: number, lngB: number) =>
          lngA + ((level - ea) / (eb - ea)) * (lngB - lngA);
        const interpLat = (ea: number, eb: number, latA: number, latB: number) =>
          latA + ((level - ea) / (eb - ea)) * (latB - latA);

        const top = (): [number, number] => [interpLng(e00, e10, lng0, lng1), lat0];
        const bottom = (): [number, number] => [interpLng(e01, e11, lng0, lng1), lat1];
        const left = (): [number, number] => [lng0, interpLat(e00, e01, lat0, lat1)];
        const right = (): [number, number] => [lng1, interpLat(e10, e11, lat0, lat1)];

        switch (cellCase) {
          case 1: case 14: points.push(left(), bottom()); break;
          case 2: case 13: points.push(bottom(), right()); break;
          case 3: case 12: points.push(left(), right()); break;
          case 4: case 11: points.push(top(), right()); break;
          case 5:
            points.push(top(), left());
            segments.push([...points]);
            points.length = 0;
            points.push(bottom(), right());
            break;
          case 6: case 9: points.push(top(), bottom()); break;
          case 7: case 8: points.push(top(), left()); break;
          case 10:
            points.push(top(), right());
            segments.push([...points]);
            points.length = 0;
            points.push(left(), bottom());
            break;
        }

        if (points.length === 2) {
          segments.push(points);
        }
      }
    }

    const merged = mergeSegments(segments);
    for (const line of merged) {
      if (line.length >= 2) {
        features.push({
          type: "Feature",
          properties: { elevation: level },
          geometry: {
            type: "LineString",
            coordinates: line,
          },
        });
      }
    }
  }

  return {
    elevationData: {
      width: cols,
      height: rows,
      cellSize: 30,
      minElevation: Math.round(minElev),
      maxElevation: Math.round(maxElev),
    },
    contours: {
      type: "FeatureCollection",
      features,
    },
  };
}

function mergeSegments(segments: [number, number][][]): [number, number][][] {
  if (segments.length === 0) return [];
  const lines: [number, number][][] = [];
  const used = new Set<number>();
  const EPS = 1e-8;

  function ptEq(a: [number, number], b: [number, number]): boolean {
    return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
  }

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const line = [...segments[i]];
    let merged = true;
    while (merged) {
      merged = false;
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        const seg = segments[j];
        if (ptEq(line[line.length - 1], seg[0])) {
          line.push(seg[1]);
          used.add(j);
          merged = true;
        } else if (ptEq(line[line.length - 1], seg[1])) {
          line.push(seg[0]);
          used.add(j);
          merged = true;
        } else if (ptEq(line[0], seg[1])) {
          line.unshift(seg[0]);
          used.add(j);
          merged = true;
        } else if (ptEq(line[0], seg[0])) {
          line.unshift(seg[1]);
          used.add(j);
          merged = true;
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

function sampleElevationGrid(
  tiles: ParsedDemTile[],
  bounds: GeoBounds,
  sampleStep: number = 0.001
): { samples: { lng: number; lat: number; elev: number }[]; step: number } {
  const samples: { lng: number; lat: number; elev: number }[] = [];
  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += sampleStep) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += sampleStep) {
      const elev = getElevationAtPoint(tiles, lng, lat);
      if (elev > -500) {
        samples.push({ lng, lat, elev });
      }
    }
  }
  return { samples, step: sampleStep };
}

export async function getElevationData(
  bounds: GeoBounds
): Promise<any> {
  const tileInfos = getDemTileUrls(bounds);
  console.log(`Fetching ${tileInfos.length} Copernicus DEM tiles...`);

  const tiles: ParsedDemTile[] = [];
  for (const info of tileInfos) {
    console.log(`  Fetching DEM tile ${info.latLabel}_${info.lonLabel}...`);
    const tile = await fetchAndParseDemTile(info.url);
    if (tile) {
      tiles.push(tile);
      console.log(`  Got ${tile.width}x${tile.height} DEM tile`);
    }
  }

  if (tiles.length === 0) {
    console.error("No DEM tiles could be fetched");
    return {
      elevationData: { width: 0, height: 0, cellSize: 30, minElevation: 0, maxElevation: 0 },
      contours: { type: "FeatureCollection", features: [] },
      rasterSamples: [],
    };
  }

  console.log("Generating contour lines...");
  const result = generateContours(tiles, bounds, 25);
  console.log(`Generated ${result.contours.features.length} contour features`);

  console.log("Sampling DEM raster at cell resolution...");
  const cellSizeDeg = 1 / 111.32;
  const { samples } = sampleElevationGrid(tiles, bounds, cellSizeDeg / 3);
  console.log(`Sampled ${samples.length} DEM raster points`);

  return {
    ...result,
    rasterSamples: samples,
  };
}

export function computeElevationMetrics(
  grid: any,
  elevationData: any,
  bounds: GeoBounds
): void {
  const samples = elevationData?.rasterSamples;
  if (!samples || samples.length === 0) return;

  const cellSizeDeg = 1 / 111.32;
  const halfCell = cellSizeDeg / 2;

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    const cellMinLng = cx - halfCell;
    const cellMaxLng = cx + halfCell;
    const cellMinLat = cy - halfCell;
    const cellMaxLat = cy + halfCell;

    const cellSamples: number[] = [];
    for (const s of samples) {
      if (s.lng >= cellMinLng && s.lng <= cellMaxLng &&
          s.lat >= cellMinLat && s.lat <= cellMaxLat &&
          s.elev > -500 && s.elev < 9000) {
        cellSamples.push(s.elev);
      }
    }

    if (cellSamples.length > 0) {
      const meanElev = cellSamples.reduce((a: number, b: number) => a + b, 0) / cellSamples.length;
      cell.properties.metrics.elevation_mean = Math.round(meanElev * 10) / 10;

      if (cellSamples.length > 1) {
        const maxElev = Math.max(...cellSamples);
        const minElev = Math.min(...cellSamples);
        const elevRange = maxElev - minElev;
        const cellSizeM = cellSizeDeg * 111320;
        const slopeRad = Math.atan(elevRange / cellSizeM);
        cell.properties.metrics.slope_mean = Math.min(slopeRad / (Math.PI / 4), 1);
      }
    }
  }
}

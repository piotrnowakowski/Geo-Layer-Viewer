import type { GeoBounds } from "@shared/schema";

export function generateGrid(bounds: GeoBounds, cellSizeKm: number = 1): any {
  const cellSizeDeg = cellSizeKm / 111.32;

  const features: any[] = [];
  let cellId = 0;

  for (let lat = bounds.minLat; lat < bounds.maxLat; lat += cellSizeDeg) {
    for (let lng = bounds.minLng; lng < bounds.maxLng; lng += cellSizeDeg) {
      const cell = {
        type: "Feature",
        properties: {
          cellId: cellId++,
          centroid: [lng + cellSizeDeg / 2, lat + cellSizeDeg / 2],
          metrics: {
            elevation_mean: 0,
            slope_mean: 0,
            flow_accumulation: 0,
            canopy_pct: 0,
            impervious_pct: 0,
            pop_density: 0,
            building_density: 0,
            river_proximity: 1,
            water_proximity: 1,
            flood_score: 0,
            heat_score: 0,
            landslide_score: 0,
            composite_risk: 0,
          },
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [lng, lat],
            [lng + cellSizeDeg, lat],
            [lng + cellSizeDeg, lat + cellSizeDeg],
            [lng, lat + cellSizeDeg],
            [lng, lat],
          ]],
        },
      };
      features.push(cell);
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export function computeRiverMetrics(grid: any, riversGeoJson: any): void {
  if (!riversGeoJson?.features?.length) return;

  const riverCoords: [number, number][] = [];
  for (const feature of riversGeoJson.features) {
    if (feature.geometry?.type === "LineString") {
      for (const coord of feature.geometry.coordinates) {
        riverCoords.push([coord[0], coord[1]]);
      }
    } else if (feature.geometry?.type === "MultiLineString") {
      for (const line of feature.geometry.coordinates) {
        for (const coord of line) {
          riverCoords.push([coord[0], coord[1]]);
        }
      }
    }
  }

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    let minDist = Infinity;
    for (const [rx, ry] of riverCoords) {
      const dist = Math.sqrt((cx - rx) ** 2 + (cy - ry) ** 2) * 111.32;
      if (dist < minDist) minDist = dist;
    }
    cell.properties.metrics.river_proximity = Math.min(minDist / 3, 1);
  }
}

export function computeWaterMetrics(grid: any, waterGeoJson: any): void {
  if (!waterGeoJson?.features?.length) return;

  const waterPoints: [number, number][] = [];
  for (const feature of waterGeoJson.features) {
    if (feature.geometry?.coordinates) {
      let rings: number[][] = [];
      if (feature.geometry.type === "Polygon") {
        rings = feature.geometry.coordinates[0];
      } else if (feature.geometry.type === "MultiPolygon") {
        for (const poly of feature.geometry.coordinates) {
          rings = rings.concat(poly[0]);
        }
      }
      for (let i = 0; i < rings.length; i += Math.max(1, Math.floor(rings.length / 20))) {
        waterPoints.push([rings[i][0], rings[i][1]]);
      }
    }
  }

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    let minDist = Infinity;
    for (const [wx, wy] of waterPoints) {
      const dist = Math.sqrt((cx - wx) ** 2 + (cy - wy) ** 2) * 111.32;
      if (dist < minDist) minDist = dist;
    }
    cell.properties.metrics.water_proximity = Math.min(minDist / 5, 1);
  }
}

export function computeLandcoverMetrics(grid: any, landcoverGeoJson: any): void {
  if (!landcoverGeoJson?.features?.length) return;

  const builtFeatures: any[] = [];
  const treeFeatures: any[] = [];

  for (const feature of landcoverGeoJson.features) {
    const cls = feature.properties?.landcover_class;
    if (cls === "builtUp") builtFeatures.push(feature);
    if (cls === "trees") treeFeatures.push(feature);
  }

  const cellSizeDeg = 1 / 111.32;
  const halfCell = cellSizeDeg / 2;

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    const cellMinLng = cx - halfCell;
    const cellMaxLng = cx + halfCell;
    const cellMinLat = cy - halfCell;
    const cellMaxLat = cy + halfCell;

    let builtArea = 0;
    let treeArea = 0;

    for (const bf of builtFeatures) {
      const overlap = computeOverlapFraction(bf, cellMinLng, cellMaxLng, cellMinLat, cellMaxLat);
      builtArea += overlap;
    }

    for (const tf of treeFeatures) {
      const overlap = computeOverlapFraction(tf, cellMinLng, cellMaxLng, cellMinLat, cellMaxLat);
      treeArea += overlap;
    }

    cell.properties.metrics.impervious_pct = Math.min(builtArea, 1);
    cell.properties.metrics.canopy_pct = Math.min(treeArea, 1);
  }
}

export function computeBuildingMetrics(grid: any, buildingData: any): void {
  if (!buildingData?.centroids?.length) return;

  const cellSizeDeg = 1 / 111.32;
  const halfCell = cellSizeDeg / 2;
  const cellAreaKm2 = (cellSizeDeg * 111.32) * (cellSizeDeg * 111.32 * Math.cos(-30.03 * Math.PI / 180));

  let maxCount = 0;
  const cellCounts: number[] = [];

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    const cellMinLng = cx - halfCell;
    const cellMaxLng = cx + halfCell;
    const cellMinLat = cy - halfCell;
    const cellMaxLat = cy + halfCell;

    let buildingCount = 0;
    for (const b of buildingData.centroids) {
      if (b.lng >= cellMinLng && b.lng <= cellMaxLng &&
          b.lat >= cellMinLat && b.lat <= cellMaxLat) {
        buildingCount++;
      }
    }

    cellCounts.push(buildingCount);
    if (buildingCount > maxCount) maxCount = buildingCount;
  }

  for (let i = 0; i < grid.features.length; i++) {
    const count = cellCounts[i];
    const density = maxCount > 0 ? count / maxCount : 0;
    grid.features[i].properties.metrics.building_density = density;
    grid.features[i].properties.metrics.building_count = count;
    grid.features[i].properties.metrics.buildings_per_km2 = Math.round(count / cellAreaKm2);
  }
}

export function computePopulationMetrics(grid: any, popData: any): void {
  if (!popData?.samples?.length) return;

  const cellSizeDeg = 1 / 111.32;
  const halfCell = cellSizeDeg / 2;

  let maxPop = 0;
  const cellPops: number[] = [];

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    const cellMinLng = cx - halfCell;
    const cellMaxLng = cx + halfCell;
    const cellMinLat = cy - halfCell;
    const cellMaxLat = cy + halfCell;

    let totalPop = 0;
    for (const s of popData.samples) {
      if (s.lng >= cellMinLng && s.lng <= cellMaxLng &&
          s.lat >= cellMinLat && s.lat <= cellMaxLat) {
        totalPop += s.pop;
      }
    }

    cellPops.push(totalPop);
    if (totalPop > maxPop) maxPop = totalPop;
  }

  for (let i = 0; i < grid.features.length; i++) {
    const pop = cellPops[i];
    grid.features[i].properties.metrics.pop_density = maxPop > 0 ? pop / maxPop : 0;
    grid.features[i].properties.metrics.population = Math.round(pop);
  }
}

function computeOverlapFraction(
  feature: any,
  cellMinLng: number,
  cellMaxLng: number,
  cellMinLat: number,
  cellMaxLat: number
): number {
  const coords = getOuterRing(feature);
  if (!coords || coords.length === 0) return 0;

  let fMinLng = Infinity, fMaxLng = -Infinity;
  let fMinLat = Infinity, fMaxLat = -Infinity;
  for (const c of coords) {
    if (c[0] < fMinLng) fMinLng = c[0];
    if (c[0] > fMaxLng) fMaxLng = c[0];
    if (c[1] < fMinLat) fMinLat = c[1];
    if (c[1] > fMaxLat) fMaxLat = c[1];
  }

  if (fMaxLng < cellMinLng || fMinLng > cellMaxLng ||
      fMaxLat < cellMinLat || fMinLat > cellMaxLat) {
    return 0;
  }

  const overlapMinLng = Math.max(fMinLng, cellMinLng);
  const overlapMaxLng = Math.min(fMaxLng, cellMaxLng);
  const overlapMinLat = Math.max(fMinLat, cellMinLat);
  const overlapMaxLat = Math.min(fMaxLat, cellMaxLat);

  const overlapArea = (overlapMaxLng - overlapMinLng) * (overlapMaxLat - overlapMinLat);
  const cellArea = (cellMaxLng - cellMinLng) * (cellMaxLat - cellMinLat);

  if (cellArea <= 0) return 0;

  const featureArea = (fMaxLng - fMinLng) * (fMaxLat - fMinLat);
  const featureFill = Math.min(featureArea / cellArea, 1);

  return (overlapArea / cellArea) * Math.min(featureFill, 1);
}

function getOuterRing(feature: any): number[][] | null {
  if (!feature?.geometry?.coordinates) return null;
  const geom = feature.geometry;
  if (geom.type === "Polygon") return geom.coordinates[0];
  if (geom.type === "MultiPolygon") return geom.coordinates[0]?.[0];
  return null;
}

export function computeFlowAccumulation(grid: any, elevationData: any): void {
  const samples = elevationData?.rasterSamples;
  if (!samples || samples.length === 0) return;

  const lats = samples.map((s: any) => s.lat);
  const lngs = samples.map((s: any) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const uniqueLats = [...new Set(lats.map((l: number) => Math.round(l * 10000) / 10000))].sort((a: number, b: number) => a - b);
  const uniqueLngs = [...new Set(lngs.map((l: number) => Math.round(l * 10000) / 10000))].sort((a: number, b: number) => a - b);

  const rows = uniqueLats.length;
  const cols = uniqueLngs.length;
  const latStep = rows > 1 ? (maxLat - minLat) / (rows - 1) : 0.003;
  const lngStep = cols > 1 ? (maxLng - minLng) / (cols - 1) : 0.003;

  const dem = new Float32Array(rows * cols).fill(-9999);
  for (const s of samples) {
    const r = Math.round((maxLat - s.lat) / latStep);
    const c = Math.round((s.lng - minLng) / lngStep);
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      dem[r * cols + c] = s.elev;
    }
  }

  const d8Offsets: [number, number][] = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];
  const d8Dist = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414];

  const flowDir = new Int8Array(rows * cols).fill(-1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const elev = dem[r * cols + c];
      if (elev <= -9000) continue;
      let maxDrop = 0;
      let bestDir = -1;
      for (let d = 0; d < 8; d++) {
        const nr = r + d8Offsets[d][0];
        const nc = c + d8Offsets[d][1];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nElev = dem[nr * cols + nc];
        if (nElev <= -9000) continue;
        const drop = (elev - nElev) / d8Dist[d];
        if (drop > maxDrop) {
          maxDrop = drop;
          bestDir = d;
        }
      }
      flowDir[r * cols + c] = bestDir;
    }
  }

  const accumulation = new Float32Array(rows * cols).fill(1);

  const sortedCells: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (dem[r * cols + c] > -9000) {
        sortedCells.push([r, c]);
      }
    }
  }
  sortedCells.sort((a, b) => dem[b[0] * cols + b[1]] - dem[a[0] * cols + a[1]]);

  for (const [r, c] of sortedCells) {
    const idx = r * cols + c;
    const dir = flowDir[idx];
    if (dir >= 0) {
      const nr = r + d8Offsets[dir][0];
      const nc = c + d8Offsets[dir][1];
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        accumulation[nr * cols + nc] += accumulation[idx];
      }
    }
  }

  const depression = new Uint8Array(rows * cols).fill(0);
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const elev = dem[r * cols + c];
      if (elev <= -9000) continue;
      if (flowDir[r * cols + c] === -1) {
        let isDepression = true;
        for (const [dr, dc] of d8Offsets) {
          const ne = dem[(r + dr) * cols + (c + dc)];
          if (ne <= -9000) { isDepression = false; break; }
        }
        if (isDepression) depression[r * cols + c] = 1;
      }
    }
  }

  let maxAccum = 0;
  for (let i = 0; i < accumulation.length; i++) {
    if (dem[i] > -9000 && accumulation[i] > maxAccum) maxAccum = accumulation[i];
  }

  const cellSizeDeg = 1 / 111.32;
  const halfCell = cellSizeDeg / 2;

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    const cellMinLng = cx - halfCell;
    const cellMaxLng = cx + halfCell;
    const cellMinLat = cy - halfCell;
    const cellMaxLat = cy + halfCell;

    let totalAccum = 0;
    let depressionCount = 0;
    let sampleCount = 0;

    const rMin = Math.max(0, Math.floor((maxLat - cellMaxLat) / latStep));
    const rMax = Math.min(rows - 1, Math.ceil((maxLat - cellMinLat) / latStep));
    const cMin = Math.max(0, Math.floor((cellMinLng - minLng) / lngStep));
    const cMax = Math.min(cols - 1, Math.ceil((cellMaxLng - minLng) / lngStep));

    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        if (dem[r * cols + c] <= -9000) continue;
        totalAccum += accumulation[r * cols + c];
        if (depression[r * cols + c]) depressionCount++;
        sampleCount++;
      }
    }

    if (sampleCount > 0 && maxAccum > 0) {
      cell.properties.metrics.flow_accumulation = clamp(totalAccum / sampleCount / maxAccum);
    }
    cell.properties.metrics.depression_pct = sampleCount > 0 ? depressionCount / sampleCount : 0;

    const slopeDeg = cell.properties.metrics.slope_mean * 45;
    cell.properties.metrics.flatness = slopeDeg > 0 ? Math.max(0, 1 - slopeDeg / 50) : 0.5;
  }
}

export function computeCompositeScores(grid: any): void {
  const cells = grid.features;

  const riverDists = cells.map((c: any) => c.properties.metrics.river_proximity);
  const waterDists = cells.map((c: any) => c.properties.metrics.water_proximity);
  const elevations = cells.map((c: any) => c.properties.metrics.elevation_mean);

  const riverRanks = rankInvert(riverDists);
  const waterRanks = rankInvert(waterDists);
  const elevRanks = rankInvert(elevations);

  for (let i = 0; i < cells.length; i++) {
    const m = cells[i].properties.metrics;

    const flowAccumPct = m.flow_accumulation;
    const depressionPct = m.depression_pct || 0;
    const riverProx = riverRanks[i];
    const waterProx = waterRanks[i];
    const lowLying = elevRanks[i];
    const imperv = m.impervious_pct;
    const flatness = m.flatness ?? 0.5;

    m.flood_score = Math.round(clamp(
      flowAccumPct * 0.25 +
      depressionPct * 0.15 +
      riverProx * 0.20 +
      waterProx * 0.10 +
      lowLying * 0.15 +
      imperv * 0.10 +
      flatness * 0.05
    ) * 100) / 100;

    m.heat_score = clamp(
      m.impervious_pct * 0.3 +
      (1 - m.canopy_pct) * 0.25 +
      m.building_density * 0.25 +
      m.pop_density * 0.2
    );

    m.landslide_score = clamp(
      m.slope_mean * 0.35 +
      m.flow_accumulation * 0.25 +
      (1 - m.canopy_pct) * 0.2 +
      (1 - m.river_proximity) * 0.2
    );

    m.composite_risk = (m.flood_score + m.heat_score + m.landslide_score) / 3;
  }
}

function rankInvert(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  const n = values.length;
  for (let r = 0; r < n; r++) {
    ranks[indexed[r].i] = 1 - r / (n - 1);
  }
  return ranks;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

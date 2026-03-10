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
    cell.properties.metrics.river_proximity = Math.min(minDist / 10, 1);
  }
}

export function computeWaterMetrics(grid: any, waterGeoJson: any): void {
  if (!waterGeoJson?.features?.length) return;

  const waterCentroids: [number, number][] = [];
  for (const feature of waterGeoJson.features) {
    if (feature.geometry?.coordinates) {
      const coords = feature.geometry.type === "Polygon"
        ? feature.geometry.coordinates[0]
        : feature.geometry.type === "MultiPolygon"
          ? feature.geometry.coordinates[0][0]
          : [];
      if (coords.length > 0) {
        const cx = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length;
        const cy = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length;
        waterCentroids.push([cx, cy]);
      }
    }
  }

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    let minDist = Infinity;
    for (const [wx, wy] of waterCentroids) {
      const dist = Math.sqrt((cx - wx) ** 2 + (cy - wy) ** 2) * 111.32;
      if (dist < minDist) minDist = dist;
    }
    cell.properties.metrics.water_proximity = Math.min(minDist / 10, 1);
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

export function computeCompositeScores(grid: any): void {
  for (const cell of grid.features) {
    const m = cell.properties.metrics;

    m.flood_score = clamp(
      (1 - m.river_proximity) * 0.35 +
      m.impervious_pct * 0.25 +
      m.flow_accumulation * 0.2 +
      (1 - m.water_proximity) * 0.2
    );

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

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

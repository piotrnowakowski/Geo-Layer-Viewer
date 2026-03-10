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

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    let nearBuilt = false;
    let nearTrees = false;

    for (const bf of builtFeatures) {
      if (isPointNearFeature(cx, cy, bf, 0.01)) {
        nearBuilt = true;
        break;
      }
    }
    for (const tf of treeFeatures) {
      if (isPointNearFeature(cx, cy, tf, 0.01)) {
        nearTrees = true;
        break;
      }
    }

    const cellHash = hashCoord(cx, cy);
    cell.properties.metrics.impervious_pct = nearBuilt ? 0.3 + cellHash * 0.5 : cellHash * 0.15;
    cell.properties.metrics.canopy_pct = nearTrees ? 0.2 + (1 - cellHash) * 0.5 : (1 - cellHash) * 0.1;
  }
}

export function computePopulationMetrics(grid: any, popGeoJson: any): void {
  if (!popGeoJson?.features?.length) return;

  for (const cell of grid.features) {
    const [cx, cy] = cell.properties.centroid;
    let nearResidential = false;

    for (const feature of popGeoJson.features) {
      if (isPointNearFeature(cx, cy, feature, 0.01)) {
        nearResidential = true;
        break;
      }
    }

    const cellHash = hashCoord(cx, cy);
    cell.properties.metrics.pop_density = nearResidential ? 0.1 + cellHash * 0.6 : cellHash * 0.05;
    cell.properties.metrics.building_density = nearResidential ? 0.1 + (1 - cellHash) * 0.5 : (1 - cellHash) * 0.05;
  }
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

function hashCoord(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function isPointNearFeature(px: number, py: number, feature: any, threshold: number): boolean {
  if (!feature.geometry?.coordinates) return false;
  const coords = feature.geometry.type === "Polygon"
    ? feature.geometry.coordinates[0]
    : feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates[0][0]
      : [];

  for (const coord of coords) {
    if (Math.abs(coord[0] - px) < threshold && Math.abs(coord[1] - py) < threshold) {
      return true;
    }
  }
  return false;
}

export function clusterZones(grid: any): any {
  const highRiskCells = grid.features.filter(
    (f: any) => f.properties.metrics.composite_risk > 0.3
  );

  const zones: Map<string, any[]> = new Map();

  for (const cell of highRiskCells) {
    const m = cell.properties.metrics;
    let typology = "LOW";

    const isFlood = m.flood_score > 0.3;
    const isHeat = m.heat_score > 0.3;
    const isLandslide = m.landslide_score > 0.3;

    if (isFlood && isHeat) typology = "FLOOD_HEAT";
    else if (isFlood && isLandslide) typology = "FLOOD_LANDSLIDE";
    else if (isHeat && isLandslide) typology = "HEAT_LANDSLIDE";
    else if (isFlood) typology = "FLOOD";
    else if (isHeat) typology = "HEAT";
    else if (isLandslide) typology = "LANDSLIDE";

    if (!zones.has(typology)) zones.set(typology, []);
    zones.get(typology)!.push(cell);
  }

  const features: any[] = [];
  let zoneId = 1;

  for (const [typology, cells] of zones) {
    if (cells.length < 3) continue;

    const allCoords = cells.map((c: any) => c.geometry.coordinates[0]);
    const mergedCoords = allCoords.flat();
    const minLng = Math.min(...mergedCoords.map((c: number[]) => c[0]));
    const maxLng = Math.max(...mergedCoords.map((c: number[]) => c[0]));
    const minLat = Math.min(...mergedCoords.map((c: number[]) => c[1]));
    const maxLat = Math.max(...mergedCoords.map((c: number[]) => c[1]));

    const avgMetrics = {
      flood: cells.reduce((s: number, c: any) => s + c.properties.metrics.flood_score, 0) / cells.length,
      heat: cells.reduce((s: number, c: any) => s + c.properties.metrics.heat_score, 0) / cells.length,
      landslide: cells.reduce((s: number, c: any) => s + c.properties.metrics.landslide_score, 0) / cells.length,
    };

    const primaryHazard = typology.includes("FLOOD") ? "flood"
      : typology.includes("HEAT") ? "heat"
      : typology.includes("LANDSLIDE") ? "landslide"
      : "low";

    const interventionMap: Record<string, string> = {
      FLOOD: "sponge_network",
      HEAT: "cooling_network",
      LANDSLIDE: "slope_stabilization",
      FLOOD_HEAT: "multi_benefit",
      FLOOD_LANDSLIDE: "sponge_network",
      HEAT_LANDSLIDE: "cooling_network",
      LOW: "multi_benefit",
    };

    features.push({
      type: "Feature",
      properties: {
        zoneId: `zone-${zoneId++}`,
        name: `${typology.replace(/_/g, "-")} Zone ${zoneId - 1}`,
        typologyLabel: typology,
        primaryHazard,
        interventionType: interventionMap[typology] || "multi_benefit",
        meanFlood: Math.round(avgMetrics.flood * 100) / 100,
        meanHeat: Math.round(avgMetrics.heat * 100) / 100,
        meanLandslide: Math.round(avgMetrics.landslide * 100) / 100,
        areaKm2: Math.round(cells.length * 1 * 100) / 100,
        cellCount: cells.length,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat],
        ]],
      },
    });
  }

  return {
    totalZones: features.length,
    geoJson: { type: "FeatureCollection", features },
  };
}

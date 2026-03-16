/**
 * Spatial Analysis Service
 *
 * Vector overlay operations for NbS site selection using Turf.js.
 * All GeoJSON is loaded from the server-side disk cache populated by existing route handlers.
 */

import * as turf from "@turf/turf";
import type {
  FeatureCollection,
  Feature,
  Point,
  Polygon,
  MultiPolygon,
  LineString,
  MultiLineString,
} from "geojson";
import fs from "fs";
import path from "path";

// ── Layer registry ─────────────────────────────────────────────────────────

const CACHE_DIR = path.resolve(process.cwd(), "client", "public", "sample-data");

const LAYER_FILES: Record<string, string> = {
  "grid":              "porto-alegre-grid.json",
  "rivers":            "porto-alegre-rivers.json",
  "flood-2024":        "porto-alegre-flood-2024.json",
  "ibge-settlements":  "porto-alegre-ibge-settlements.json",
  "ibge-indicators":   "porto-alegre-ibge-indicators.json",
  "transit-routes":    "porto-alegre-transit-routes.json",
  "transit-stops":     "porto-alegre-transit-stops.json",
  "sites-parks":       "porto-alegre-sites-parks.json",
  "sites-schools":     "porto-alegre-sites-schools.json",
  "sites-hospitals":   "porto-alegre-sites-hospitals.json",
  "sites-social":      "porto-alegre-sites-social.json",
  "sites-sports":      "porto-alegre-sites-sports.json",
  "sites-wetlands":    "porto-alegre-sites-wetlands.json",
  "sites-vacant":      "porto-alegre-sites-vacant.json",
  "sites-flood-zones": "porto-alegre-sites-flood_zones.json",
  "forest":            "porto-alegre-forest.json",
  "landcover":         "porto-alegre-landcover.json",
  "population":        "porto-alegre-population.json",
  "buildings":         "porto-alegre-buildings.json",
  "boundary":          "porto-alegre-boundary.json",
};

export function listVectorLayers(): string[] {
  return Object.keys(LAYER_FILES);
}

const _layerCache = new Map<string, FeatureCollection>();

export function loadLayer(layerId: string): FeatureCollection {
  const cached = _layerCache.get(layerId);
  if (cached) return cached;

  const filename = LAYER_FILES[layerId];
  if (!filename) throw new Error(`Unknown vector layer: "${layerId}"`);

  const filePath = path.join(CACHE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Layer "${layerId}" has not been loaded yet. ` +
        `Fetch /api/geospatial/${layerId.replace("sites-", "sites/")} once to populate the cache.`
    );
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  // Many cached files wrap the FeatureCollection in a top-level "geoJson" key
  const fc = (raw?.geoJson ?? raw) as FeatureCollection;
  if (!fc?.features) {
    throw new Error(`Layer "${layerId}" file does not contain a valid FeatureCollection`);
  }
  _layerCache.set(layerId, fc);
  return fc;
}

export function clearLayerCache(): void {
  _layerCache.clear();
}

// ── Grid cell filter ────────────────────────────────────────────────────────

/**
 * Read a possibly-nested property using dot-notation.
 * e.g. "metrics.flood_score" reads f.properties.metrics.flood_score
 */
function readProp(props: Record<string, any> | null | undefined, field: string): unknown {
  if (!props) return undefined;
  const parts = field.split(".");
  let cur: any = props;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Filter a grid GeoJSON by a score field (supports "metrics.flood_score" notation)
 * and minimum threshold. Returns a FeatureCollection of polygons whose score >= threshold.
 */
export function filterGridByScore(
  grid: FeatureCollection,
  scoreField: string,
  threshold: number
): FeatureCollection {
  // Support both flat ("flood_score") and nested ("metrics.flood_score") paths
  const resolvedField =
    !scoreField.includes(".") && grid.features[0]?.properties?.metrics !== undefined
      ? `metrics.${scoreField}`
      : scoreField;

  const filtered = grid.features.filter((f) => {
    const val = readProp(f.properties, resolvedField);
    return typeof val === "number" && val >= threshold;
  });
  return turf.featureCollection(filtered);
}

// ── Vector analysis operations ─────────────────────────────────────────────

export interface AnalysisResult {
  type: "FeatureCollection";
  features: Feature[];
  _meta: {
    operation: string;
    count: number;
    totalA: number;
    description: string;
    stats?: Record<string, number | string>;
  };
}

/**
 * points_in_layer
 * Returns features from layerA (any geometry) whose centroid lies within
 * any polygon in layerB (after optional buffering).
 *
 * If layerB contains non-polygon geometries (e.g. lines), they are buffered
 * by `bufferMeters` (default 100 m) to create polygon zones.
 *
 * If `scoreField` and `scoreThreshold` are provided, layerB is filtered
 * before the spatial test.
 */
export function pointsInLayer(
  layerA: FeatureCollection,
  layerB: FeatureCollection,
  options: {
    bufferMeters?: number;
    scoreField?: string;
    scoreThreshold?: number;
  } = {}
): AnalysisResult {
  const { bufferMeters = 100, scoreField, scoreThreshold } = options;

  // Optionally filter layerB by score
  let zonesFC: FeatureCollection = layerB;
  if (scoreField !== undefined && scoreThreshold !== undefined) {
    zonesFC = filterGridByScore(layerB, scoreField, scoreThreshold);
  }

  // Buffer non-polygon geometries
  const polyFeatures: Feature<Polygon | MultiPolygon>[] = [];
  for (const f of zonesFC.features) {
    const gtype = f.geometry?.type;
    if (gtype === "Polygon" || gtype === "MultiPolygon") {
      polyFeatures.push(f as Feature<Polygon | MultiPolygon>);
    } else if (gtype && bufferMeters > 0) {
      const buffered = turf.buffer(f, bufferMeters, { units: "meters" });
      if (buffered) polyFeatures.push(buffered as Feature<Polygon | MultiPolygon>);
    }
  }

  if (polyFeatures.length === 0) {
    return {
      type: "FeatureCollection",
      features: [],
      _meta: {
        operation: "points_in_layer",
        count: 0,
        totalA: layerA.features.length,
        description: "No zone features available after filtering",
      },
    };
  }

  const zonesUnion = turf.featureCollection(polyFeatures);

  const matched: Feature[] = [];
  for (const feat of layerA.features) {
    if (!feat.geometry) continue;
    let testPoint: Feature<Point> | null = null;
    const gtype = feat.geometry.type;
    if (gtype === "Point") {
      testPoint = feat as Feature<Point>;
    } else {
      // Use centroid for lines/polygons
      testPoint = turf.centroid(feat);
    }
    const inside = polyFeatures.some((zone) =>
      turf.booleanPointInPolygon(testPoint!, zone)
    );
    if (inside) matched.push(feat);
  }

  // Compute stats for score field if present
  const stats: Record<string, number | string> = {};
  if (scoreField) {
    const vals = matched
      .map((f) => f.properties?.[scoreField] as number | undefined)
      .filter((v): v is number => typeof v === "number");
    if (vals.length > 0) {
      stats[`mean_${scoreField}`] = Number(
        (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)
      );
      stats[`max_${scoreField}`] = Number(Math.max(...vals).toFixed(3));
    }
  }

  return {
    type: "FeatureCollection",
    features: matched,
    _meta: {
      operation: "points_in_layer",
      count: matched.length,
      totalA: layerA.features.length,
      description: `${matched.length} of ${layerA.features.length} features fall within the specified zones`,
      stats,
    },
  };
}

/**
 * intersect_lines
 * Returns features from layerA (lines or polygons) that intersect or cross
 * any feature in layerB after buffering by `bufferMeters`.
 *
 * Useful for: "which transit routes cross high-risk flood grid cells?"
 */
export function intersectLines(
  layerA: FeatureCollection,
  layerB: FeatureCollection,
  options: {
    bufferMeters?: number;
    scoreField?: string;
    scoreThreshold?: number;
  } = {}
): AnalysisResult {
  const { bufferMeters = 0, scoreField, scoreThreshold } = options;

  let zonesFC: FeatureCollection = layerB;
  if (scoreField !== undefined && scoreThreshold !== undefined) {
    zonesFC = filterGridByScore(layerB, scoreField, scoreThreshold);
  }

  // Build union of zones (buffered if needed)
  const polyFeatures: Feature<Polygon | MultiPolygon>[] = [];
  for (const f of zonesFC.features) {
    const gtype = f.geometry?.type;
    if (gtype === "Polygon" || gtype === "MultiPolygon") {
      if (bufferMeters > 0) {
        const buf = turf.buffer(f, bufferMeters, { units: "meters" });
        if (buf) polyFeatures.push(buf as Feature<Polygon | MultiPolygon>);
      } else {
        polyFeatures.push(f as Feature<Polygon | MultiPolygon>);
      }
    } else if (gtype && bufferMeters > 0) {
      const buf = turf.buffer(f, bufferMeters, { units: "meters" });
      if (buf) polyFeatures.push(buf as Feature<Polygon | MultiPolygon>);
    }
  }

  if (polyFeatures.length === 0) {
    return {
      type: "FeatureCollection",
      features: [],
      _meta: {
        operation: "intersect_lines",
        count: 0,
        totalA: layerA.features.length,
        description: "No zone features available after filtering",
      },
    };
  }

  const matched: Feature[] = [];
  for (const feat of layerA.features) {
    if (!feat.geometry) continue;
    const crosses = polyFeatures.some((zone) => {
      try {
        return turf.booleanCrosses(feat, zone) || turf.booleanContains(zone, feat);
      } catch {
        // booleanCrosses can throw for some geometry combinations; fall back to centroid test
        const c = turf.centroid(feat);
        return turf.booleanPointInPolygon(c, zone);
      }
    });
    if (crosses) matched.push(feat);
  }

  const stats: Record<string, number | string> = {};
  const lengths = matched
    .filter((f) => f.geometry?.type === "LineString" || f.geometry?.type === "MultiLineString")
    .map((f) => turf.length(f as Feature<LineString | MultiLineString>, { units: "kilometers" }));
  if (lengths.length > 0) {
    stats.total_km = Number(lengths.reduce((a, b) => a + b, 0).toFixed(2));
  }

  return {
    type: "FeatureCollection",
    features: matched,
    _meta: {
      operation: "intersect_lines",
      count: matched.length,
      totalA: layerA.features.length,
      description: `${matched.length} of ${layerA.features.length} features intersect the specified zones`,
      stats,
    },
  };
}

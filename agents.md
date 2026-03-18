# Geospatial Data Visualizer — Agent Guide

Porto Alegre, Brazil geospatial data visualizer.
Full-stack TypeScript (Express + React/Vite). Leaflet maps. Dark theme (CityCatalyst design system, Poppins, primary blue `#001fa8`).

**Golden rule: all data must be real — no synthetic, mocked, or placeholder values.**

---

## Project layout

```
client/src/
  data/
    layer-configs.ts        ← single source of truth for all layers
    colors.ts               ← colour helpers (solar, poverty)
    sample-data-loaders.ts  ← fetches GeoJSON data from backend API, caches in memory
  lib/
    layerFactory.ts         ← createLayerFromData() — Leaflet rendering per layer id
    valueTileUtils.ts       ← raster decode helpers, sampleRasterAtPoint()
  components/map/
    MapViewer.tsx           ← map init, toggleLayer(), buildPostprocessedLayer()
    EvidenceDrawer.tsx      ← layer panel (reads LAYER_SECTIONS/LAYER_GROUPS)
    LegendPanel.tsx         ← active-layer legend
    ValueTooltip.tsx        ← hover pixel decode tooltip
  pages/
    DataPage.tsx            ← LAYER_DATA_INFO[] — provenance docs per layer
    MapPage.tsx             ← thin wrapper around MapViewer

server/
  routes.ts                 ← all API routes, OEF_TILE_LAYERS config, S3 proxy
  services/                 ← OSM, rivers, flood, transit, solar, IBGE, … loaders
```

---

## Layer taxonomy

Every layer belongs to exactly one **group**, every group to one **section**.

### Sections (LAYER_SECTIONS in layer-configs.ts)
| id | display label | purpose |
|---|---|---|
| `oef_catalog` | OEF Geospatial Data | Raw OEF S3 raster tiles + GeoJSON |
| `derived` | Reference Layers | OSM-derived GeoJSON, GTFS, climate sites |
| `postprocessing` | Spatial Queries | Vector × raster intersections |

### Groups (LAYER_GROUPS in layer-configs.ts)
| id | section | label |
|---|---|---|
| `urban_land` | oef_catalog | Land Use & Urban Form |
| `environment` | oef_catalog | Environment & Ecology |
| `population` | oef_catalog | Population & Society |
| `hydrology` | oef_catalog | Hydrology & Terrain |
| `climate_extreme` | oef_catalog | Extreme Climate Indices |
| `climate_projections` | oef_catalog | Climate Projections |
| `base_layers` | derived | Base Layers |
| `sites` | derived | Climate Sites |
| `spatial_queries` | postprocessing | Spatial Queries |

Adding a new group requires editing both `LAYER_GROUPS` and the `LayerGroup` type in layer-configs.ts.
Adding a new section requires editing both `LAYER_SECTIONS` and the `LayerSection` type.

---

## Finding data in the OEF catalog

### S3 base URL
```
https://geo-test-api.s3.us-east-1.amazonaws.com/
```

### OEF path conventions

Visual tiles (human-readable PNG, no data value):
```
<dataset>/<path>/tiles_visual/{z}/{x}/{y}.png
```

Value tiles (machine-readable RGB-encoded data):
```
<dataset>/<path>/tiles_values/{z}/{x}/{y}.png
```

Porto Alegre zoom-11 reference tile: `z=11, x=732, y=1203`

### Probing accessibility
Before adding a layer, confirm it actually returns HTTP 200 — many OEF paths return 403.
```bash
curl -o /dev/null -s -w "%{http_code}" \
  "https://geo-test-api.s3.us-east-1.amazonaws.com/<your-path>/tiles_visual/11/732/1203.png"
```
Only add layers whose tiles return 200. Set `available: false` for layers that are defined but currently 403.

### Known accessible datasets (as of 2026-03-16)
- `dynamic_world/release/v1/2023/porto_alegre/` — land use
- `ghsl_built_up/release/v1/2025/porto_alegre/` — built surface
- `ghsl_degree_urbanization/release/v2/2024/porto_alegre/` — urbanisation
- `ghsl_population/release/v1/2025/porto_alegre/` — population
- `noaa_viirs_nightlights/release/v1/2024/` — night lights (global)
- `copernicus_emsn194/release/v1/2024/porto_alegre/` — 2024 flood depth
- `modis_ndvi/release/v1/2024/` — NDVI (global)
- `merit_hydro/release/v1/porto_alegre/{elv,upa,hnd}/` — terrain
- `copernicus_dem/release/v1/2024/porto_alegre/` — DEM
- `jrc_global_surface_water/release/v1/porto_alegre/{occurrence,seasonality,transition}/`
- `hansen_forest_change/release/v1/2024/porto_alegre/{loss,tree_cover_2000}/`
- `global_solar_atlas/release/v2/` — solar PV
- `nbs/porto_alegre/climate_hazards/extreme_precipitation/chirps/V2_0/…` — CHIRPS (value_tiles accessible)
- `nbs/porto_alegre/climate_hazards/heatwave_indices/hwm/{2024,2030s_ssp245,2030s_ssp585,2050s_ssp245,2100s_ssp585}/` — HWM
- `nbs/porto_alegre/climate_hazards/floods/flood_risk_index/oef_calculation/{2024,2030s_ssp245,2050s_ssp585,…}/` — FRI
- `br_ibge/release/2024/porto_alegre/poa_informal_settlements.geojson`
- `br_ibge/release/2010/porto_alegre/porto_alegre_indicators.geojson`
- `poa-gtfs/release/2024-10-01/{stops,shapes}.geojson`

### Known inaccessible (403)
- ERA5 value_tiles (visual tiles work, value tiles 403)
- GHSL, JRC, DEM, MERIT, Hansen value_tiles (visual tiles work)
- `nbs/.../hwm/annual_climatology/` — visual works, value_tiles 403
- `oef_canopy_cover`, `oef_opportunity_zones`, `oef_heat_hazard`, `oef_cooling`, `oef_composite_risk`, `oef_slope`, `oef_flow_accumulation`, `oef_flood_hazard`, `oef_exposure` — all 403, marked `available: false`

---

## Value tile encoding

OEF value tiles encode numbers into RGB pixels. The decode formula is in `valueTileUtils.ts`:

```
numeric:     value = (R + 256·G + 65536·B + offset) / scale
categorical: class_id = R   (G=B=0)
alpha < 10 → nodata
```

Each layer's encoding is declared in `valueEncoding` in `layer-configs.ts`:

```ts
valueEncoding: {
  type: "numeric",         // "numeric" | "categorical"
  scale: 100,              // denominator
  offset: 6,               // addend before dividing (from OEF datasets.yaml)
  unit: "index 0–1",       // display string
  urlTemplate: vtUrl("nbs/porto_alegre/…"),  // value tile URL template
  classes: { 0: "Water", 1: "Trees", … },   // for categorical only
}
```

The `vtUrl()` helper in `layer-configs.ts` builds `tiles_values/{z}/{x}/{y}.png` paths:
```ts
const vtUrl = (path: string) =>
  `${S3}/${path}/tiles_values/{z}/{x}/{y}.png`;
```

`hasValueTiles: true` means the layer has confirmed accessible value tiles (or inline GeoJSON values). Set to `false` for visual-only tiles where pixel values are colours, not data.

### Getting scale/offset for a new OEF dataset
Check `https://github.com/Open-Earth-Foundation/geospatial-data` → `datasets.yaml`.
Fields: `value_tile_encoding.scale` and `value_tile_encoding.offset`.

### OEF custom colormap (orange-red = LOW → dark navy = HIGH)
```
#c82500 → #f67b00 → #ffdc54 → #d1f090 → #8fdab3 → #46c1da → #028bda → #08306b
```
This is the canonical OEF colormap for continuous risk/hazard layers.

---

## How to add a new OEF tile layer

### Step 1 — Probe the tile
```bash
curl -o /dev/null -s -w "%{http_code}" \
  "https://geo-test-api.s3.us-east-1.amazonaws.com/<path>/tiles_visual/11/732/1203.png"
# Must return 200
```
Also probe value_tiles if you want hover decode:
```bash
curl -o /dev/null -s -w "%{http_code}" \
  "https://geo-test-api.s3.us-east-1.amazonaws.com/<path>/tiles_values/11/732/1203.png"
```

### Step 2 — Register the tile URL in server/routes.ts
Add an entry to `OEF_TILE_LAYERS`:
```ts
my_new_layer: {
  urlTemplate:
    "https://geo-test-api.s3.us-east-1.amazonaws.com/<path>/tiles_visual/{z}/{x}/{y}.png",
},
```
That's all the server needs — the route loop `GET /api/geospatial/tiles/:layerId/:z/:x/:y.png` handles it automatically.

### Step 3 — Add the LayerConfig in client/src/data/layer-configs.ts
```ts
{
  id: "oef_my_new_layer",
  name: "Human-readable name",
  icon: SomeLucideIcon,
  color: "#hexcolor",
  source: "tiles",
  group: "climate_extreme",   // pick the right group
  available: true,
  tileLayerId: "my_new_layer",  // must match OEF_TILE_LAYERS key
  hasValueTiles: true,          // true only if value_tiles probe returned 200
  valueEncoding: {
    type: "numeric",
    scale: 100,
    offset: 600,              // from datasets.yaml
    unit: "°C·days",
    urlTemplate: vtUrl("nbs/porto_alegre/…"),
  },
},
```

No further code is needed — `MapViewer.tsx` renders tile layers generically.

### Step 4 — Add DataPage documentation in client/src/pages/DataPage.tsx
Append to `LAYER_DATA_INFO[]`:
```ts
{
  id: "oef_my_new_layer",
  methodology: "…",
  source: "…",
  sourceUrl: "https://github.com/Open-Earth-Foundation/geospatial-data",
  date: "…",
  resolution: "~9 km",
  coverage: "Porto Alegre municipality and surroundings",
  notes: "…",
},
```

---

## How to add a new GeoJSON layer

GeoJSON layers are fetched from the backend, which either fetches from S3 or derives data from OSM/other services.

### Step 1 — Add a server route in server/routes.ts

For a simple S3-hosted GeoJSON, add entries to the existing dictionaries:
```ts
const S3_GEOJSON_URLS: Record<string, string> = {
  "my-data": "https://geo-test-api.s3.us-east-1.amazonaws.com/…/my_data.geojson",
};

const S3_CACHE_FILES: Record<string, string> = {
  "my-data": "porto-alegre-my-data.json",
};
```
Then add the route using `registerCachedRoute`:
```ts
registerCachedRoute(app, "/api/geospatial/my-data", "porto-alegre-my-data.json", async (bounds) => {
  const url = S3_GEOJSON_URLS["my-data"];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`S3 ${res.status}`);
  return res.json();
});
```
For complex derivations (OSM queries, spatial joins), create a service in `server/services/` and call it from the route.

### Step 2 — Wire the API call in client/src/data/sample-data-loaders.ts
The `loadLayerData(layerId)` function maps layer ids to API calls. Add a case:
```ts
case "my_layer_id":
  return fetchAndCache("/api/geospatial/my-data", "my-data");
```

### Step 3 — Add the LayerConfig in layer-configs.ts
```ts
{
  id: "my_layer_id",
  name: "My Layer",
  icon: SomeIcon,
  color: "#hex",
  source: "geojson",
  group: "base_layers",
  available: true,
  hasValueTiles: true,
},
```

### Step 4 — Add Leaflet rendering in client/src/lib/layerFactory.ts
Add a case to `createLayerFromData()`:
```ts
case "my_layer_id": {
  const geoJson = data?.geoJson || data;
  if (!geoJson?.features) return null;
  return L.geoJSON(geoJson, {
    style: { color: "#hex", weight: 2, opacity: 0.8 },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      (layer as any).bindTooltip(`<strong>${p.name}</strong>`, { sticky: true });
    },
  });
}
```

### Step 5 — Add DataPage documentation (same as tile layer Step 4)

---

## How to add a new spatial query layer

Spatial query layers filter a vector dataset by sampling an OEF raster at each feature's centroid or midpoint. They run entirely client-side on layer activation.

### Step 1 — Add the LayerConfig in layer-configs.ts
```ts
{
  id: "post_my_query",
  name: "My Query Result",
  icon: AlertTriangle,
  color: "#ef4444",
  source: "geojson",
  group: "spatial_queries",
  available: true,
  hasValueTiles: true,
  valueEncoding: { type: "numeric", unit: "FRI index" },
},
```

### Step 2 — Add the builder in client/src/components/map/MapViewer.tsx

In `buildPostprocessedLayer()`, add a branch:
```ts
if (layerId === "post_my_query") {
  // 1. Load source vector data
  const data = await loadLayerData("ibge_settlements");  // or any vector layer id
  const geoJson = data?.geoJson || data;
  if (!geoJson?.features) return null;

  // 2. Get raster config for the hazard layer
  const rasterConfig = LAYER_CONFIGS.find((l) => l.id === "oef_fri_2024");
  const enc = rasterConfig?.valueEncoding;
  if (!enc?.urlTemplate) return null;

  const THRESHOLD = 0.4;
  const passed: any[] = [];

  // 3. Sample raster at centroid of each feature, filter by threshold
  for (const feature of geoJson.features) {
    const point = geometryCentroid(feature.geometry);      // for polygons/points
    // or: const point = linestringMidpoint(feature.geometry);  // for lines
    if (!point) continue;
    const value = await sampleRasterAtPoint(point[0], point[1], enc, 11);
    if (value !== null && value > THRESHOLD) {
      passed.push({ ...feature, properties: { ...feature.properties, sampled_value: value } });
    }
  }

  if (passed.length === 0) return null;

  // 4. Return a Leaflet layer
  return L.geoJSON(
    { type: "FeatureCollection", features: passed } as any,
    {
      style: { color: "#ef4444", fillColor: "#dc2626", fillOpacity: 0.7, weight: 2.5 },
      onEachFeature: (feature, layer) => {
        const val = feature.properties.sampled_value?.toFixed(3) ?? "?";
        (layer as any).bindTooltip(
          `<strong>Value: ${val}</strong> (threshold: ${THRESHOLD})`,
          { sticky: true }
        );
      },
    }
  );
}
```

### Step 3 — Register the id in the dispatch in MapViewer.tsx

The `if (layerId === "post_settlements_flood" || layerId === "post_bus_heatwave")` guard needs to include your new id:
```ts
if (["post_settlements_flood", "post_bus_heatwave", "post_my_query"].includes(layerId)) {
```

### Step 4 — Add DataPage documentation

Document the vector source, raster source, threshold, decode formula, and whether the result is a full or partial match (as the two existing examples show).

### Geometry helper functions (in valueTileUtils.ts)
| function | use for |
|---|---|
| `geometryCentroid(geometry)` | Polygon, MultiPolygon, Point, mixed |
| `linestringMidpoint(geometry)` | LineString, MultiLineString |
| `sampleRasterAtPoint(lat, lng, encoding, z=11)` | Fetches tile, decodes pixel |
| `latLngToTilePixel(lat, lng, z)` | Returns `{tileX, tileY, px, py}` |
| `fetchTilePixels(s3Url)` | Returns `ImageData` (256×256), cached |
| `decodePixelNumeric(r,g,b,a, encoding)` | Returns decoded number or null |
| `decodePixelDisplay(r,g,b,a, encoding)` | Returns formatted string or null |

---

## Server caching pattern

Long-running data fetches use the `registerCachedRoute` helper in `server/routes.ts`:
```ts
registerCachedRoute(
  app,
  "/api/geospatial/my-endpoint",
  "porto-alegre-my-data.json",   // cache filename in client/public/sample-data/
  async (bounds: GeoBounds) => {
    // fetch or compute data, return a JSON-serialisable object
    return myData;
  }
);
```
- On first call, fetches real data, saves to `client/public/sample-data/<filename>`.
- On subsequent calls (including server restarts), loads from the JSON file.
- `bounds` is computed from the Porto Alegre OSM boundary (bbox).

---

## Server tile proxy

Tile layers are proxied through `/api/geospatial/tiles/:layerId/:z/:x/:y.png`.
The server looks up the `urlTemplate` in `OEF_TILE_LAYERS`, substitutes `{z}/{x}/{y}`, and proxies the S3 response. No auth is required for the OEF S3 bucket.

Value tiles are proxied through `/api/geospatial/proxy-tile?url=<encoded-s3-url>`.
**Only URLs starting with `https://geo-test-api.s3.us-east-1.amazonaws.com/` are allowed** (hard-coded allowlist in the route). Do not change this prefix check.

---

## EvidenceDrawer rendering

`EvidenceDrawer.tsx` reads `LAYER_SECTIONS → LAYER_GROUPS → LAYER_CONFIGS` to build the panel automatically. You do not need to edit EvidenceDrawer when adding layers — as long as the new `LayerConfig` has a valid `group` that maps to a known section, it will appear in the correct place in the panel.

Layers with `available: false` are excluded from the panel (the component filters them out via `layerState.available`).

---

## DataPage (provenance documentation)

`client/src/pages/DataPage.tsx` contains `LAYER_DATA_INFO[]`.
Every layer with `available: true` should have a matching entry.
The page renders grouped cards automatically from `LAYER_SECTIONS/LAYER_GROUPS`.
If a layer has no `LAYER_DATA_INFO` entry, its card shows empty methodology/source fields — always add an entry when activating a layer.

Required fields:
```ts
{
  id: "layer_id",          // must match LayerConfig.id exactly
  methodology: "…",        // how the data was produced or the query was computed
  source: "…",             // dataset name + provider
  sourceUrl: "…",          // URL to catalogue / GitHub / data provider
  date: "…",               // observation date, period, or projection horizon
  resolution: "…",         // spatial resolution (e.g. "~5 km", "~9 km", "Vector")
  coverage: "…",           // geographic coverage and feature count if applicable
  notes: "…",              // caveats, thresholds, known limitations
}
```

---

## Map configuration constants

| constant | value |
|---|---|
| Map center | `[-30.0346, -51.2177]` (Porto Alegre) |
| Default zoom | 11 |
| Porto Alegre reference tile (z=11) | x=732, y=1203 |
| Basemap | CartoDB Dark Matter |
| City boundary source | OSM (loaded at init) |

---

## Design system

- Font: Poppins (Google Fonts, loaded in index.html)
- Primary blue: `#001fa8`
- Background: `zinc-950` (`#09090b`)
- Panels: `zinc-900/95` with backdrop blur
- All interactive elements must have `data-testid` attributes (see layer toggle buttons in EvidenceDrawer)
- Layer indicator colours are declared per-layer in `LayerConfig.color` and used in both the panel pill and the legend

---

## Checklist when adding any layer

- [ ] S3 tile or GeoJSON URL probed and returns HTTP 200
- [ ] `OEF_TILE_LAYERS` entry added (tile layers only)
- [ ] `LayerConfig` entry added to `LAYER_CONFIGS` in `layer-configs.ts`
- [ ] `LayerGroup` type updated if a new group was introduced
- [ ] `LayerSection` type updated if a new section was introduced
- [ ] `loadLayerData` case added in `sample-data-loaders.ts` (GeoJSON layers only)
- [ ] Server route registered in `routes.ts` (GeoJSON layers only)
- [ ] `createLayerFromData` case added in `layerFactory.ts` (GeoJSON layers only)
- [ ] `buildPostprocessedLayer` branch added in `MapViewer.tsx` + id added to dispatch guard (spatial query layers only)
- [ ] `LAYER_DATA_INFO` entry added in `DataPage.tsx`
- [ ] Value tile encode/decode tested against Porto Alegre reference tile x=732, y=1203, z=11

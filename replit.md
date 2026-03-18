# Geospatial Data Visualizer — Porto Alegre

## Overview
A standalone geospatial data visualizer for Porto Alegre, Brazil. Full-screen interactive Leaflet map with real evidence layers from the OEF geospatial catalog, OSM, IBGE, and EPTC transit feeds. Users toggle layers and read decoded values; no synthetic data, no mock values anywhere.

## Critical Rules
- **NEVER use synthetic/mock/placeholder data** — always real data from real sources
- Sample data files in `client/public/sample-data/` contain real geospatial data cached from live APIs
- `available: false` layers remain defined but hidden from the UI until their S3 tiles are confirmed accessible

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Leaflet, TanStack Query v5, Tailwind CSS, shadcn/ui
- **Backend**: Express, TypeScript, tsx
- **Map**: Leaflet with CartoDB Dark Matter basemap
- **Spatial**: @turf/turf, osmtogeojson, geotiff

## Architecture
```
client/src/
  data/
    layer-configs.ts       — All LayerConfig entries (LAYER_CONFIGS, LAYER_GROUPS, LAYER_SECTIONS, ValueTileEncoding)
    colors.ts              — Color helpers (solar PV, poverty)
    sample-data-loaders.ts — Fetch GeoJSON from API; in-memory cache per layer id
  lib/
    layerFactory.ts        — createLayerFromData() — Leaflet rendering per layer id
    valueTileUtils.ts      — OEF value tile decode, sampleRasterAtPoint(), centroid/midpoint helpers
  components/map/
    MapViewer.tsx          — Map init, toggleLayer(), buildPostprocessedLayer()
    EvidenceDrawer.tsx     — Layer toggle panel (driven by LAYER_SECTIONS / LAYER_GROUPS)
    LegendPanel.tsx        — Active-layer legend
    ValueTooltip.tsx       — Hover value decode tooltip
  pages/
    DataPage.tsx           — LAYER_DATA_INFO[] — per-layer provenance docs
    not-found.tsx          — 404

server/
  routes.ts                — All API routes; OEF_TILE_LAYERS dict; S3 proxy; registerCachedRoute() helper
  services/
    osmService.ts          — OSM Nominatim boundary
    riversService.ts       — Overpass waterway queries
    osmSitesService.ts     — OSM POI layers (parks, schools, hospitals, …)
    flood2024Service.ts    — 2024 flood extent GeoJSON
    worldpopService.ts     — WorldPop 2020 population raster
    copernicusService.ts   — Copernicus DEM GeoTIFF
    cogSamplerService.ts   — COG raster sampling (JRC, Hansen)
    spatialAnalysisService.ts — Vector layer loading + spatial ops
    gridService.ts         — Analysis grid + composite scoring
    overpassHelper.ts      — Retry + bbox reduction for Overpass

shared/schema.ts           — Shared TypeScript types (GeoBounds, etc.)
client/public/sample-data/ — Cached real GeoJSON (rivers, transit, solar, IBGE, settlements, sites)
```

## Layer System
66 layers active (`available: true`), 9 coming soon (`available: false`).

**Sections and groups:**
- `oef_catalog` → `urban_land`, `environment`, `population`, `hydrology`, `climate_extreme`, `climate_projections`
- `derived` → `base_layers`, `sites`
- `postprocessing` → `spatial_queries`

## Value Tile Encoding
OEF value tiles encode numeric values into RGB pixels:
```
Numeric:      value = (R + 256·G + 65536·B + offset) / scale
Categorical:  class_id = R
Nodata:       alpha < 10
```
`scale` and `offset` come from OEF `datasets.yaml`. Implemented in `client/src/lib/valueTileUtils.ts`.

17 layers expose real decoded values in-tool (CHIRPS indices, FRI, HWM, Dynamic World, census, solar, transit, sites, spatial queries).

## OEF S3 Tile Proxy
- Visual tiles: `GET /api/geospatial/tiles/:layerId/:z/:x/:y.png` — proxies from `OEF_TILE_LAYERS` lookup
- Value tiles: `GET /api/geospatial/proxy-tile?url=<encoded>` — only allows `https://geo-test-api.s3.us-east-1.amazonaws.com/` prefix

## Server Caching
GeoJSON routes use `registerCachedRoute(app, path, cacheFile, loader)` — fetches once, saves to `client/public/sample-data/<file>`, serves from cache on all subsequent calls.

## Map Configuration
- Center: `[-30.0346, -51.2177]` (Porto Alegre)
- Default zoom: 11
- Reference tile (z=11): x=732, y=1203
- Basemap: CartoDB Dark Matter

## Design System
- Font: Poppins (Google Fonts)
- Primary blue: `#001fa8`
- Background: `zinc-950`
- Panels: `zinc-900/95` with backdrop blur
- Dark mode: always on

## Running
`npm run dev` — starts Express + Vite on port 5000.
Data loads from cached JSON files on startup; API endpoints are fallbacks if cache files are absent.

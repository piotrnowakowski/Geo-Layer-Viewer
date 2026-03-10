# NbS Map Visualizer

## Overview
A standalone geospatial evidence layer viewer for Nature-Based Solutions (NbS) planning. Full-screen interactive Leaflet map centered on Porto Alegre, Brazil with multi-layered evidence visualization. Users load real geospatial layers and perform their own analysis and workflows downstream.

## Critical Rules
- **NEVER use synthetic/mock/placeholder data** — always use real data from real sources (OSM, Copernicus, OEF S3, etc.)
- Sample data files in `client/public/sample-data/` contain real geospatial data fetched from actual APIs
- Even "sample data" means real data cached locally for performance
- **No intervention zones, zone panels, or NbS recommendations** — this is a pure evidence layer viewer

## Data Sources
- **City boundaries**: OpenStreetMap Nominatim API
- **Rivers, water bodies, forest, land cover, population**: OSM Overpass API (with retry logic via overpassHelper)
- **Elevation/terrain**: Copernicus DEM 30m from S3 (`copernicus-dem-30m.s3.eu-central-1.amazonaws.com`) — real GeoTIFF tiles parsed with `geotiff` package, contours generated via marching squares, DEM raster values sampled directly at cell resolution
- **OEF tile layers**: geo-test-api.s3.us-east-1.amazonaws.com (Dynamic World land use tiles)
- **Grid analysis**: Computed from real spatial overlap with OSM rivers, water, landcover, forest, population data + Copernicus DEM elevation/slope

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Leaflet, @turf/turf, TanStack Query, Tailwind CSS, shadcn/ui
- **Backend**: Express, TypeScript
- **Map**: Leaflet with CartoDB Dark Matter basemap
- **Packages**: leaflet, @types/leaflet, @turf/turf, osmtogeojson, geotiff

## Architecture
```
client/src/
  components/
    map/
      MapViewer.tsx        — Core Leaflet map + layer management + data fetching
      EvidenceDrawer.tsx   — Bottom panel with 20 layer toggle buttons (3 groups)
    layout/
      Header.tsx           — App header with Fetch Real Data button
  data/
    layer-configs.ts       — 20 layer definitions (id, name, icon, color, source, group, availability)
    colors.ts              — Color scales for flood/heat/landslide/population/building + landcover colors
    sample-data-loaders.ts — Load from cached JSON files first, then fallback to API
  pages/
    Home.tsx               — Renders MapViewer

server/
  routes.ts                — API endpoints (boundary, rivers, water, forest, landcover, population, elevation, grid, tiles, fetch-all)
  services/
    osmService.ts          — Nominatim boundary fetching
    riversService.ts       — Overpass waterway queries
    surfaceWaterService.ts — Overpass water body queries
    forestService.ts       — Overpass forest/wood queries
    worldcoverService.ts   — Overpass landcover queries
    populationService.ts   — Overpass residential area queries
    copernicusService.ts   — Copernicus DEM S3 tile fetching, GeoTIFF parsing, contour generation, raster sampling, per-cell elevation/slope computation
    gridService.ts         — Grid generation + real spatial overlap metrics + composite scoring
    overpassHelper.ts      — Retry logic + bbox reduction + fallback endpoints for Overpass API

shared/schema.ts           — TypeScript interfaces for all data types

client/public/sample-data/ — Cached real data
  porto-alegre-boundary.json, porto-alegre-rivers.json, porto-alegre-surface-water.json,
  porto-alegre-forest.json, porto-alegre-landcover.json, porto-alegre-population.json,
  porto-alegre-elevation.json (contours + raster samples from Copernicus DEM),
  porto-alegre-grid.json (1216 cells with real metrics)
```

## Grid Metrics (all from real data)
- **elevation_mean**: Direct DEM raster sampling (Copernicus 30m), averaged across samples within each cell
- **slope_mean**: Computed from elevation range within each cell using DEM raster samples
- **river_proximity**: Euclidean distance to nearest OSM river coordinate, normalized to [0,1]
- **water_proximity**: Distance to nearest OSM water body centroid, normalized
- **canopy_pct**: Bounding-box overlap fraction of OSM tree polygons within cell
- **impervious_pct**: Bounding-box overlap fraction of OSM builtUp polygons within cell
- **pop_density**: Cumulative overlap coverage of OSM residential polygons within cell
- **building_density**: Count of overlapping residential features per cell, normalized
- **flood_score, heat_score, landslide_score, composite_risk**: Weighted composites of above real metrics

## Layer System (20 layers)
- **Risk Analysis** (5): Flood Risk, Heat Risk, Landslide Risk, Population Density, Building Density
- **Environment** (5): Elevation, Land Cover, Water Bodies, Rivers, Forest
- **OEF Geospatial** (10): Dynamic World (tiles), Slope, Flow Accumulation, Canopy Cover, Flood/Heat Hazard, Exposure, Cooling Capacity, Composite Risk, NbS Opportunity Zones (most unavailable — tiles not yet on S3)

## Key Design Decisions
- Dark theme with CartoDB Dark Matter basemap
- Bottom evidence drawer for layer toggles (grouped by category)
- Layer data cached in Map<string, any> ref for instant toggle on/off
- Data loaded from cached JSON files first, API fallback only if files missing
- Overpass queries use bbox reduction (0.15-0.25 of full bounds) to avoid timeouts
- 2-second delays between sequential Overpass queries to avoid rate limiting
- No intervention zones or NbS recommendations — users do their own analysis

## Map Configuration
- Center: [-30.0346, -51.2177] (Porto Alegre)
- Default zoom: 11
- OEF tile maxNativeZoom: 15
- Dark basemap: CartoDB Dark Matter

## Running
- `npm run dev` starts Express backend + Vite frontend on port 5000
- All cached data loads instantly on page load
- "Fetch Real Data" button triggers sequential API calls for fresh data

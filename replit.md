# NbS Map Visualizer

## Overview
A standalone geospatial map visualizer for Nature-Based Solutions (NbS) planning. Full-screen interactive Leaflet map centered on Porto Alegre, Brazil with multi-layered evidence visualization, intervention zone analysis, and NbS recommendation panels.

## Critical Rules
- **NEVER use synthetic/mock/placeholder data** — always use real data from real sources (OSM, Copernicus, OEF S3, etc.)
- Sample data files in `client/public/sample-data/` contain real geospatial data fetched from actual APIs
- Even "sample data" means real data cached locally for performance

## Data Sources
- **City boundaries**: OpenStreetMap Nominatim API
- **Rivers, water bodies, forest, land cover, population**: OSM Overpass API (with retry logic via overpassHelper)
- **Elevation/terrain**: Copernicus DEM S3 (stubbed — complex GeoTIFF parsing needed)
- **OEF tile layers**: geo-test-api.s3.us-east-1.amazonaws.com (Dynamic World land use tiles)
- **Grid analysis**: Computed from real river, water, landcover, forest, and population data

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Leaflet, @turf/turf, TanStack Query, Tailwind CSS, shadcn/ui
- **Backend**: Express, TypeScript
- **Map**: Leaflet with CartoDB Dark Matter basemap
- **Packages**: leaflet, @types/leaflet, @turf/turf, osmtogeojson

## Architecture
```
client/src/
  components/
    map/
      MapViewer.tsx       — Core Leaflet map + layer management + data fetching
      EvidenceDrawer.tsx   — Bottom panel with 21 layer toggle buttons (3 groups)
      ZonePriorityPanel.tsx — Right panel showing intervention zones sorted by risk
      ZoneDetailPanel.tsx   — Left floating panel with zone details + NbS recommendations
    layout/
      Header.tsx           — App header with Fetch Real Data button
  data/
    layer-configs.ts       — 21 layer definitions (id, name, icon, color, source, group, availability)
    colors.ts              — Color scales for flood/heat/landslide/population/building + typology/intervention colors
    sample-data-loaders.ts — Load from cached JSON files first, then fallback to API
  pages/
    Home.tsx               — Renders MapViewer

server/
  routes.ts                — All API endpoints (boundary, rivers, water, forest, landcover, population, grid, zones, interventions, tiles, fetch-all)
  services/
    osmService.ts          — Nominatim boundary fetching
    riversService.ts       — Overpass waterway queries
    surfaceWaterService.ts — Overpass water body queries
    forestService.ts       — Overpass forest/wood queries
    worldcoverService.ts   — Overpass landcover queries
    populationService.ts   — Overpass residential area queries
    gridService.ts         — Grid generation + metric computation + composite scoring + zone clustering
    interventionsData.ts   — 10 NbS intervention types across 4 categories
    overpassHelper.ts      — Retry logic + bbox reduction + fallback endpoints for Overpass API

shared/schema.ts           — TypeScript interfaces for all data types

client/public/sample-data/ — Cached real data (~4.4MB total)
  porto-alegre-boundary.json, porto-alegre-rivers.json, porto-alegre-surface-water.json,
  porto-alegre-forest.json, porto-alegre-landcover.json, porto-alegre-population.json,
  porto-alegre-grid.json, porto-alegre-zones.json, interventions.json
```

## Layer System (21 layers)
- **Risk Analysis** (6): Intervention Zones, Flood Risk, Heat Risk, Landslide Risk, Population Density, Building Density
- **Environment** (5): Elevation, Land Cover, Water Bodies, Rivers, Forest
- **OEF Geospatial** (10): Dynamic World (tiles), Slope, Flow Accumulation, Canopy Cover, Flood/Heat Hazard, Exposure, Cooling Capacity, Composite Risk, NbS Opportunity Zones (most unavailable — tiles not yet on S3)

## Key Design Decisions
- Dark theme with CartoDB Dark Matter basemap
- Bottom evidence drawer for layer toggles (6 columns, grouped)
- Right panel for zone priority list (sorted by composite risk)
- Left floating panel for zone details + applicable interventions + co-benefits
- Layer data cached in Map<string, any> ref for instant toggle on/off
- Data loaded from cached JSON files first, API fallback only if files missing
- Overpass queries use bbox reduction (0.15-0.25 of full bounds) to avoid timeouts
- 2-second delays between sequential Overpass queries to avoid rate limiting

## Map Configuration
- Center: [-30.0346, -51.2177] (Porto Alegre)
- Default zoom: 11
- OEF tile maxNativeZoom: 15
- Dark basemap: CartoDB Dark Matter

## Running
- `npm run dev` starts Express backend + Vite frontend on port 5000
- All cached data loads instantly on page load
- "Fetch Real Data" button triggers sequential API calls for fresh data

# NbS Map Visualizer

## Overview
A standalone geospatial evidence layer viewer for Nature-Based Solutions (NbS) planning. Full-screen interactive Leaflet map centered on Porto Alegre, Brazil with multi-layered evidence visualization. Users load real geospatial layers and perform their own analysis and workflows downstream.

## Critical Rules
- **NEVER use synthetic/mock/placeholder data** — always use real data from real sources (OSM, Copernicus, WorldPop, OEF S3, etc.)
- Sample data files in `client/public/sample-data/` contain real geospatial data fetched from actual APIs
- Even "sample data" means real data cached locally for performance
- **No intervention zones, zone panels, or NbS recommendations** — this is a pure evidence layer viewer

## Data Sources
- **City boundaries**: OpenStreetMap Nominatim API
- **Rivers, water bodies, forest, land cover**: OSM Overpass API (with retry logic via overpassHelper)
- **Buildings**: 517,367 real building footprint centroids from OSM Overpass API (6×6 chunk grid covering full city bounds)
- **Population**: WorldPop 2020 Constrained 100m resolution GeoTIFF for Brazil — 45,251 populated pixels covering Porto Alegre, ~2.1M total population
- **Elevation/terrain**: Copernicus DEM 30m from S3 — real GeoTIFF tiles parsed with `geotiff` package
- **OEF tile layers**: geo-test-api.s3.us-east-1.amazonaws.com (Dynamic World land use tiles, Solar PV tiles)
- **GTFS transit**: EPTC Porto Alegre bus stops (5,909 Points) and route shapes (762 LineStrings) from S3 GeoJSON
- **Solar Atlas**: Global Solar Atlas v2 neighbourhood-level PVOUT/GHI/DNI (99 polygons) from S3 GeoJSON + visual tile layer
- **IBGE Census**: Brazilian Census 2010 indicators at neighbourhood level (99 polygons: poverty_rate, income, infrastructure) from S3 GeoJSON
- **IBGE Settlements**: Informal settlement boundaries (125 polygons) from S3 GeoJSON
- **Grid analysis**: Computed from real spatial overlap with all above data sources

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
      EvidenceDrawer.tsx   — Bottom panel with 26 layer toggle buttons (5 groups)
    layout/
      Header.tsx           — App header with branding
      CityCatalystTab.tsx   — Bottom-left return-to-CityCatalyst tab
  data/
    layer-configs.ts       — 26 layer definitions (id, name, icon, color, source, group, availability)
    colors.ts              — Color scales for flood/heat/landslide/population/building/solar/poverty + landcover colors
    sample-data-loaders.ts — Load from cached JSON files first, then fallback to API

server/
  routes.ts                — API endpoints (boundary, rivers, water, forest, landcover, buildings, population, elevation, grid, tiles)
  services/
    osmService.ts          — Nominatim boundary fetching
    riversService.ts       — Overpass waterway queries
    surfaceWaterService.ts — Overpass water body queries
    forestService.ts       — Overpass forest/wood queries
    worldcoverService.ts   — Overpass landcover queries
    buildingService.ts     — OSM building footprint centroids (346K buildings via 4×4 chunk grid)
    worldpopService.ts     — WorldPop 2020 100m population raster (downloads Brazil GeoTIFF ~131MB, extracts Porto Alegre window)
    copernicusService.ts   — Copernicus DEM S3 tile fetching, GeoTIFF parsing, contour generation, raster sampling
    gridService.ts         — Grid generation + real spatial overlap metrics + composite scoring
    overpassHelper.ts      — Retry logic + bbox reduction + fallback endpoints for Overpass API

shared/schema.ts           — TypeScript interfaces for all data types

client/public/sample-data/ — Cached real data
  porto-alegre-boundary.json, porto-alegre-rivers.json, porto-alegre-surface-water.json,
  porto-alegre-forest.json, porto-alegre-landcover.json, porto-alegre-buildings.json,
  porto-alegre-population.json (WorldPop 100m raster samples),
  porto-alegre-elevation.json (contours + raster samples from Copernicus DEM),
  porto-alegre-grid.json (1216 cells with real metrics),
  porto-alegre-transit-stops.json (5,909 GTFS bus stops from EPTC),
  porto-alegre-transit-routes.json (762 GTFS route shapes from EPTC),
  porto-alegre-solar-neighbourhoods.json (99 neighbourhood solar PV polygons),
  porto-alegre-ibge-indicators.json (99 neighbourhood census indicators),
  porto-alegre-ibge-settlements.json (125 informal settlement polygons),
  worldpop_bra_2020.tif (131MB, gitignored — downloaded on first population fetch)
```

## Grid Metrics (all from real data)
- **elevation_mean**: Direct DEM raster sampling (Copernicus 30m), averaged across samples within each cell
- **slope_mean**: Computed from elevation range within each cell using DEM raster samples
- **river_proximity**: Euclidean distance to nearest OSM river coordinate, normalized to [0,1]
- **water_proximity**: Distance to nearest OSM water body centroid, normalized
- **canopy_pct**: Bounding-box overlap fraction of OSM tree polygons within cell
- **impervious_pct**: Bounding-box overlap fraction of OSM builtUp polygons within cell
- **pop_density**: WorldPop 2020 population sum per cell, normalized by maximum (776 cells with data, ~17,975 people in densest cell)
- **population**: Raw population count per cell from WorldPop
- **building_density**: OSM building count per cell, normalized by maximum (750 cells with data, full city coverage)
- **building_count**: Raw building count per cell
- **buildings_per_km2**: Buildings per square kilometer (range: 2–5,991)
- **flood_score**: f(river_proximity, impervious_pct, flow_accumulation, water_proximity)
- **heat_score**: f(impervious_pct, canopy_inverse, building_density, pop_density)
- **landslide_score**: f(slope, flow_accumulation, canopy_inverse, river_proximity)
- **composite_risk**: Average of flood, heat, landslide scores

## Grid Caching
- Grid is only cached to disk when ALL critical dependencies (buildings + elevation + population) are present
- Both GET /api/geospatial/grid and POST /api/geospatial/fetch-all enforce this gating
- If dependencies are missing, grid is computed but not persisted

## Layer System (62 layers, 10 groups)
- **Risk Analysis** (5): Flood Risk, Heat Risk, Landslide Risk, Population Density, Building Density
- **Environment** (6): Elevation, Land Cover, Water Bodies, Rivers, Forest, Solar Potential
- **Transport** (2): Bus Routes, Bus Stops
- **Social & Demographics** (2): Census Indicators, Informal Settlements
- **Geospatial Layers** (11): Dynamic World, Solar PV, JRC Surface Water Transition, GHSL Built-Up, GHSL Urbanisation, Hansen Forest Loss, GHSL Population, VIIRS Night Lights, Copernicus EMSN194 Flood, MODIS NDVI, MERIT Hydro HAND — all available via OEF S3 tile proxy
- **Hydrology & Terrain** (6): Copernicus DEM, MERIT ELV, MERIT UPA, JRC Occurrence, JRC Seasonality, Hansen Treecover 2000 — all available via OEF S3
- **Extreme Climate Indices** (20): CHIRPS R90p/R95p/R99p/RX1day/RX5day × (2024 + climatology baseline), ERA5-Land TNx/TX90p/TX99p/TXx × (2024 + climatology), HWM 2024 + HWM climatology — all available via OEF S3
- **Climate Projections** (11): Flood Risk Index 2024 + 2030s/2050s/2100s × SSP2-4.5/SSP5-8.5, Heatwave Magnitude 2030s/2050s/2100s — all available via OEF S3
- **Placeholder OEF tiles** (6): Slope, Flow Accumulation, Canopy Cover, Flood/Heat Hazard, Exposure, Cooling, Composite Risk, NbS Opportunity Zones (available: false — tiles pending)
- **Base Layers** (1): Rivers (OSM waterways — kept; elevation/surface_water/forest removed, superseded by OEF rasters)
- **Climate Sites** (7+): Parks, Schools, Hospitals, Wetlands, Sports, Social, Vacant, Flood Zones, Flood 2024

## DataPage Disclaimer
- All OEF tile layers show a "For Calculations" amber callout on the Data Sources page
- Disclaimer explains tiles are pre-rendered PNGs (RGB display colours, not raw values)
- Access path varies by layer: GEE (JRC/GHSL/Hansen/MODIS/MERIT), CHIRPS FTP/GEE, Copernicus CDS API (ERA5-Land), AWS Open Data (Copernicus DEM), OEF GitHub (FRI/HWM computed indices)
- Logic in `getRawDataAccess(layerId)` function — dispatches by ID prefix to 5 access-string constants

## Design System
- **CityCatalyst design system** from Open Earth Foundation
- **Font**: Poppins (Google Fonts, weights 300-700)
- **Primary blue**: `hsl(224, 100%, 33%)` = `#001fa8` — same in both light and dark mode
- **Dark mode**: Always on via `document.documentElement.classList.add("dark")` in main.tsx
- **CityCatalystTab**: Bottom-left corner tab with `#3B63C4` background, linking to citycatalyst.openearth.dev
- **site-explorer-panel CSS**: Applied to EvidenceDrawer for pointer-events isolation on Leaflet overlays
- **Color tokens**: Aligned with CityCatalyst spec (primary, secondary, muted, accent, destructive, success)
- Custom scrollbar, fade-in animation, leaflet dark controls all styled per design system

## Key Design Decisions
- Dark theme with CartoDB Dark Matter basemap
- Bottom evidence drawer for layer toggles (grouped by category)
- Layer data cached in Map<string, any> ref for instant toggle on/off
- Data loaded from cached JSON files first, API fallback only if files missing
- Overpass queries use bbox reduction (0.15-0.25 of full bounds) to avoid timeouts
- Building fetch uses 6×6 chunk grid with 2s delays between chunks to cover full city bounds
- WorldPop GeoTIFF downloaded once (~131MB) and cached locally; only Porto Alegre window extracted
- No intervention zones or NbS recommendations — users do their own analysis

## Map Configuration
- Center: [-30.0346, -51.2177] (Porto Alegre)
- Default zoom: 11
- OEF tile maxNativeZoom: 15
- Dark basemap: CartoDB Dark Matter

## Running
- `npm run dev` starts Express backend + Vite frontend on port 5000
- All data loads instantly from cached JSON files — no manual fetch needed
- Individual API endpoints still available as fallbacks if cached files are missing

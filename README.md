# Geospatial Data Visualizer — Porto Alegre

An interactive, full-screen geospatial data visualizer for Porto Alegre, Brazil. Built by the [OpenEarth Foundation](https://openearth.org) as a standalone evidence-layer viewer: load real spatial datasets from the OEF geospatial catalog, OSM, IBGE, and transit feeds, toggle them on the map, and read actual decoded values on hover.

> **Data rule:** every layer contains real data from real sources. No synthetic, mocked, or placeholder values anywhere in the codebase.

---

## Features

- **Full-screen Leaflet map** — CartoDB Dark Matter basemap, Porto Alegre city boundary overlay, smooth zoom/pan
- **66 active data layers** across three sections and eight thematic groups — OEF raster tiles, GeoJSON vector layers, and client-side spatial queries
- **Real value decoding** — 17 layers (CHIRPS precipitation, Flood Risk Index, Heatwave Magnitude, Dynamic World land cover, census indicators, solar potential, spatial queries) decode raw RGB-encoded pixel values or GeoJSON properties into actual numbers on hover
- **Spatial query layers** — client-side vector × raster intersection: settlements filtered by OEF FRI raster, bus routes filtered by OEF HWM raster; raster value attached to each passing feature
- **Evidence Drawer** — collapsible bottom panel listing all layers grouped by section and theme, with loading states
- **Legend Panel** — live legend for all active layers
- **Data Sources page** — per-layer provenance: methodology, source, date, resolution, coverage, and value-access status (green "values decoded" vs. amber "external access required")
- **Dark theme** — CityCatalyst design system, Poppins font, primary blue `#001fa8`

---

## Layer Catalog

### OEF Geospatial Data
| Group | Layers |
|---|---|
| Land Use & Urban Form | Dynamic World (classified), GHSL Built-Up, GHSL Urbanisation, VIIRS Night Lights |
| Environment & Ecology | Solar PV tiles, MODIS NDVI, Hansen Forest Loss |
| Population & Society | GHSL Population, IBGE Census indicators, IBGE Informal Settlements, GTFS Bus Routes, GTFS Bus Stops |
| Hydrology & Terrain | Copernicus DEM, MERIT Elevation, MERIT Upstream Area, MERIT HAND, Copernicus 2024 Flood Depth, JRC Surface Water (Occurrence / Seasonality / Change), Hansen Tree Cover 2000 |
| Extreme Climate Indices | CHIRPS R90p / R95p / R99p / RX1day / RX5day (2024 observed + 1981–2010 climatology baseline) — ERA5-Land TNx / TXx / TX90p / TX99p (2024 + baseline), HWM 2024 + baseline |
| Climate Projections | Flood Risk Index (FRI) for 2024, 2030s, 2050s, 2100s × SSP2-4.5 / SSP5-8.5 — Heatwave Magnitude (HWM) projections across same scenarios |

### Reference Layers
| Group | Layers |
|---|---|
| Base Layers | OSM Rivers & waterways |
| Climate Sites | Parks & Green Space, Schools, Hospitals, Wetlands, Sports Grounds, Community Facilities, Vacant/Brownfield Land, OSM Flood Risk Zones, 2024 Flood Extent (Planet/SkySat), VIIRS Heat Intensity (NASA GIBS) |

### Spatial Queries
| Layer | What it does |
|---|---|
| Settlements @ FRI > 0.4 | Samples OEF FRI 2024 value tile at each IBGE settlement centroid; renders only those exceeding the threshold |
| Bus Lines in HWM ≥ 10 °C·d | Samples OEF HWM 2024 value tile at each GTFS route midpoint; renders only routes meeting the threshold |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Map | Leaflet 1.9, CartoDB Dark Matter tiles |
| State / data | TanStack Query v5, React hooks |
| UI components | shadcn/ui, Tailwind CSS |
| Icons | lucide-react, react-icons/si |
| Backend | Express, TypeScript, tsx |
| Spatial | @turf/turf, osmtogeojson, geotiff |
| Raster decode | Custom RGB pixel decode (valueTileUtils.ts) |

---

## Getting Started

**Prerequisites:** Node.js 20+

```bash
# Install dependencies
npm install

# Start dev server (Express backend + Vite frontend on port 5000)
npm run dev
```

Open `http://localhost:5000`. The map loads Porto Alegre with the city boundary. Use the Evidence Drawer at the bottom of the screen to toggle layers on and off.

On first load, some layers (rivers, census, transit, solar, settlements) are fetched from their source APIs and cached as JSON files in `client/public/sample-data/`. Subsequent loads use the cache and are instant.

---

## Project Structure

```
client/src/
  data/
    layer-configs.ts        ← Single source of truth: all 75 LayerConfig entries
    colors.ts               ← Colour helpers (solar PV, poverty)
    sample-data-loaders.ts  ← GeoJSON fetch + in-memory cache per layer
  lib/
    layerFactory.ts         ← createLayerFromData() — Leaflet rendering per layer id
    valueTileUtils.ts       ← OEF value tile decode, sampleRasterAtPoint(), centroid helpers
  components/map/
    MapViewer.tsx           ← Map init, toggleLayer(), buildPostprocessedLayer()
    EvidenceDrawer.tsx      ← Layer toggle panel (reads LAYER_SECTIONS / LAYER_GROUPS)
    LegendPanel.tsx         ← Active-layer legend
    ValueTooltip.tsx        ← Hover pixel decode tooltip
  pages/
    DataPage.tsx            ← Provenance docs for every layer (LAYER_DATA_INFO[])

server/
  routes.ts                 ← All API routes; OEF_TILE_LAYERS config; S3 proxy
  services/
    osmService.ts           ← OSM Nominatim city boundary
    riversService.ts        ← Overpass waterway queries
    osmSitesService.ts      ← OSM POI layers (parks, schools, hospitals, …)
    flood2024Service.ts     ← 2024 flood extent GeoJSON
    worldpopService.ts      ← WorldPop 2020 population raster
    copernicusService.ts    ← Copernicus DEM GeoTIFF
    cogSamplerService.ts    ← COG raster sampling (JRC, Hansen lossyear)
    spatialAnalysisService.ts ← Vector layer loading + spatial ops
    gridService.ts          ← Analysis grid generation + composite scoring

shared/schema.ts            ← Shared TypeScript types (GeoBounds, etc.)
```

---

## Data Sources

| Dataset | Provider | Notes |
|---|---|---|
| OEF geospatial catalog | OpenEarth Foundation | S3: `geo-test-api.s3.us-east-1.amazonaws.com` — tile layers + GeoJSON |
| GTFS bus network | EPTC Porto Alegre | 5,909 stops, 762 route shapes — October 2024 release |
| IBGE Census 2010 | Brazilian Institute of Geography and Statistics | 99 neighbourhood polygons |
| IBGE Informal Settlements | IBGE | 125 aglomerado subnormal polygons — 2022 census |
| Global Solar Atlas | World Bank / Solargis | Neighbourhood-level PVOUT/GHI/DNI |
| City boundary | OpenStreetMap Nominatim | Porto Alegre administrative polygon |
| Rivers & sites | OpenStreetMap Overpass API | Waterways, parks, schools, hospitals, wetlands, … |
| 2024 Flood Extent | Planet/SkySat via Copernicus EMS | EMSN194 product |
| CHIRPS precipitation | UCSB Climate Hazards Group | Extreme precipitation indices via OEF S3 |
| ERA5-Land temperature | Copernicus / ECMWF | Extreme temperature indices via OEF S3 |
| Heatwave Magnitude | OEF calculation | Observed 2024 + CMIP6 projections via OEF S3 |
| Flood Risk Index | OEF calculation | Observed 2024 + CMIP6 projections via OEF S3 |
| GHSL layers | European Commission JRC | Built-up, population, degree of urbanisation |
| MERIT Hydro | Yamazaki Lab | Elevation, upstream area, HAND drainage |
| JRC Surface Water | European Commission JRC | Occurrence, seasonality, change transition |
| Hansen Forest Change | University of Maryland | Forest loss 2000–2024, tree cover 2000 |
| VIIRS Night Lights | NOAA | 2024 annual composite |
| VIIRS Heat Intensity | NASA GIBS | SNPP Band I5 Day brightness temperature |

---

## OEF Value Tile Encoding

OEF raster layers encode numeric values into PNG pixels. The decode formula (implemented in `client/src/lib/valueTileUtils.ts`):

```
Numeric:      value = (R + 256·G + 65536·B + offset) / scale
Categorical:  class_id = R  (G = B = 0)
Transparent:  alpha < 10 → nodata
```

`scale` and `offset` for each layer come from the OEF `datasets.yaml` catalog. Confirmed-accessible value tiles: all CHIRPS indices, FRI 2024 + selected projections, HWM 2024 + selected projections, Dynamic World land cover.

---

## Extending the Project

See **[agents.md](./agents.md)** for a complete guide covering:
- How to discover and probe OEF S3 datasets
- Step-by-step recipe for adding an OEF tile layer
- Step-by-step recipe for adding a GeoJSON layer
- Step-by-step recipe for adding a spatial query (vector × raster) layer
- Server caching pattern and tile proxy rules
- DataPage documentation requirements
- Full checklist for any new layer

---

## License

Data licenses vary by source — see the Data Sources page within the application for per-layer attribution.
Code: MIT.

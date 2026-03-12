import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LAYER_CONFIGS, LAYER_GROUPS, LAYER_SECTIONS } from "@/data/layer-configs";

interface LayerDataInfo {
  id: string;
  methodology: string;
  source: string;
  sourceUrl?: string;
  date: string;
  resolution: string;
  coverage: string;
  notes?: string;
}

const LAYER_DATA_INFO: LayerDataInfo[] = [
  {
    id: "grid_flood",
    methodology: "Composite flood risk index computed from 7 weighted parameters: D8 flow accumulation from DEM (25%), topographic depression detection (15%), river proximity via rank-inverted distance to nearest OSM river LineString (20%), surface water proximity via rank-inverted distance to nearest water body polygon edge (10%), low-lying terrain percentile from elevation (15%), impervious surface coverage from land use classification (10%), and terrain flatness derived from slope (5%). All parameters normalized to 0-1 range before weighting.",
    source: "Derived from Copernicus DEM, OpenStreetMap, ESA WorldCover",
    date: "DEM: 2021, OSM: 2024, WorldCover: 2021",
    resolution: "1 km grid cells",
    coverage: "Porto Alegre municipality boundary",
    notes: "Flow accumulation uses D8 steepest-descent algorithm on DEM raster. Depression cells are those where no neighbor has lower elevation. Proximity metrics use percentile-based rank inversion across all grid cells.",
  },
  {
    id: "grid_heat",
    methodology: "Composite urban heat island risk index computed from 4 weighted parameters: impervious surface percentage (30%), inverse canopy cover (25%), building density normalized to peak cell (25%), and population density normalized to peak cell (20%).",
    source: "Derived from ESA WorldCover, OpenStreetMap buildings, WorldPop",
    date: "WorldCover: 2021, OSM: 2024, WorldPop: 2020",
    resolution: "1 km grid cells",
    coverage: "Porto Alegre municipality boundary",
  },
  {
    id: "grid_landslide",
    methodology: "Composite landslide susceptibility index from 4 parameters: slope steepness from DEM (35%), flow accumulation (25%), inverse canopy cover indicating deforested slopes (20%), and river proximity indicating erosion-prone areas (20%).",
    source: "Derived from Copernicus DEM, ESA WorldCover, OpenStreetMap",
    date: "DEM: 2021, WorldCover: 2021, OSM: 2024",
    resolution: "1 km grid cells",
    coverage: "Porto Alegre municipality boundary",
  },
  {
    id: "grid_population",
    methodology: "Population density per grid cell, derived from WorldPop constrained individual countries UN-adjusted population count raster. Each 100m pixel's population is summed within the 1km grid cell and normalized to the maximum cell value across the study area.",
    source: "WorldPop — University of Southampton",
    sourceUrl: "https://www.worldpop.org/geodata/summary?id=49656",
    date: "2020 (UN-adjusted estimates)",
    resolution: "Source: 100m (3 arc-seconds); aggregated to 1 km grid",
    coverage: "Brazil national dataset clipped to Porto Alegre",
    notes: "Total estimated population: ~2.1 million across 776 grid cells with data. Uses constrained model that redistributes population to built settlement areas.",
  },
  {
    id: "grid_buildings",
    methodology: "Building density per grid cell computed from OSM building footprint centroids. The Porto Alegre boundary is queried in a 6x6 chunk grid via Overpass API. Building count per cell is normalized to the maximum count across all cells.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://overpass-api.de/",
    date: "2024 (continuously updated)",
    resolution: "Source: individual building footprints; aggregated to 1 km grid",
    coverage: "Porto Alegre municipality — 517,367 building centroids",
    notes: "Queried using [building] tag. The full city bounds are split into 36 sub-bounding boxes to stay within Overpass API size limits.",
  },
  {
    id: "elevation",
    methodology: "Elevation contours and raster samples extracted from Copernicus DEM GLO-30 via AWS Open Data. Contour lines generated at fixed elevation intervals from the 30m DEM. Slope is derived from elevation range within each grid cell.",
    source: "Copernicus DEM GLO-30 — European Space Agency",
    sourceUrl: "https://registry.opendata.aws/copernicus-dem/",
    date: "2021 (based on TanDEM-X mission data 2011-2015, updated with auxiliary data)",
    resolution: "30 meters (1 arc-second)",
    coverage: "Porto Alegre municipality — 10,848 raster sample points",
    notes: "Elevation range: -1.7m to 307.8m. Mean elevation: 34.2m. DEM hosted on AWS S3 as Cloud-Optimized GeoTIFF (COG).",
  },
  {
    id: "landcover",
    methodology: "Land cover polygons classified from ESA WorldCover 10m product via Overpass API. Classes include built-up areas, tree cover, grassland, cropland, and water. Impervious surface percentage and canopy cover percentage are computed per grid cell from polygon overlap.",
    source: "ESA WorldCover 2021 (via OpenStreetMap land use tags)",
    sourceUrl: "https://esa-worldcover.org/en",
    date: "2021",
    resolution: "Source: 10 meters; polygons aggregated to 1 km grid cells",
    coverage: "Porto Alegre municipality boundary",
    notes: "Land use classification derived from Sentinel-1 and Sentinel-2 satellite data. Built-up class includes residential, commercial, and industrial areas.",
  },
  {
    id: "surface_water",
    methodology: "Surface water body polygons (lakes, lagoons, reservoirs, ponds) extracted from OpenStreetMap via Overpass API using [natural=water], [water=lake/reservoir/lagoon/pond], and [landuse=reservoir] tags.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://wiki.openstreetmap.org/wiki/Tag:natural%3Dwater",
    date: "2024 (continuously updated)",
    resolution: "Vector polygons at full OSM detail",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Includes Guaiba Lake (Lago Guaiba), smaller urban lagoons, and man-made reservoirs. Proximity to water bodies is used in flood risk calculation.",
  },
  {
    id: "rivers",
    methodology: "River and stream line features extracted from OpenStreetMap via Overpass API using [waterway=river/stream/canal/drain] tags within the city bounding box.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://wiki.openstreetmap.org/wiki/Key:waterway",
    date: "2024 (continuously updated)",
    resolution: "Vector LineString geometries at full OSM detail",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Includes major rivers (Rio Gravataí, Arroio Dilúvio) and minor streams/canals. River proximity is a key input to flood risk scoring.",
  },
  {
    id: "forest",
    methodology: "Forest canopy polygons extracted from OpenStreetMap via Overpass API using [natural=wood], [landuse=forest], and [leisure=park]+[natural=wood] tags.",
    source: "OpenStreetMap — Overpass API",
    sourceUrl: "https://wiki.openstreetmap.org/wiki/Tag:natural%3Dwood",
    date: "2024 (continuously updated)",
    resolution: "Vector polygons at full OSM detail",
    coverage: "Porto Alegre municipality bounding box",
    notes: "Canopy cover percentage per grid cell is used in heat risk and landslide risk calculations. Higher canopy cover reduces both heat island effect and slope erosion risk.",
  },
  {
    id: "solar_potential",
    methodology: "Solar photovoltaic output potential aggregated to neighbourhood level. Mean PVOUT (kWh/kWp/day) computed from the Global Solar Atlas v2 raster for each Porto Alegre neighbourhood polygon. GHI (Global Horizontal Irradiation) and DNI (Direct Normal Irradiation) yearly means are also included.",
    source: "Global Solar Atlas — World Bank / Solargis",
    sourceUrl: "https://globalsolaratlas.info/",
    date: "Long-term average (1994-2018)",
    resolution: "Source: 250m raster; aggregated to neighbourhood polygons",
    coverage: "99 Porto Alegre neighbourhoods",
    notes: "PVOUT represents the specific yield of a grid-connected PV system with optimally tilted modules. Typical range in Porto Alegre: 3.8-4.3 kWh/kWp/day.",
  },
  {
    id: "transit_stops",
    methodology: "Public transit stop locations extracted from the official GTFS (General Transit Feed Specification) dataset published by EPTC (Empresa Publica de Transporte e Circulacao), the Porto Alegre municipal transit authority. Each stop includes geographic coordinates, stop name, and stop code.",
    source: "EPTC Porto Alegre — GTFS Static Feed",
    sourceUrl: "https://www.eptc.com.br/",
    date: "October 2024 release",
    resolution: "Individual stop point locations",
    coverage: "5,909 bus stops across Porto Alegre municipality",
    notes: "Licensed under CC BY 4.0. Data represents the complete urban bus network of Porto Alegre.",
  },
  {
    id: "transit_routes",
    methodology: "Bus route geometries (shapes) extracted from the official GTFS dataset published by EPTC. Each shape represents the geographic path followed by a bus line, stored as a LineString geometry.",
    source: "EPTC Porto Alegre — GTFS Static Feed",
    sourceUrl: "https://www.eptc.com.br/",
    date: "October 2024 release",
    resolution: "Vector LineString geometries at GTFS shape point resolution",
    coverage: "762 route shapes across Porto Alegre municipality",
    notes: "Licensed under CC BY 4.0. Shapes represent the spatial paths of bus routes; schedule/frequency data is not included in this layer.",
  },
  {
    id: "ibge_census",
    methodology: "Socioeconomic indicators aggregated to neighbourhood level from the Brazilian Census 2010 (IBGE). Includes total population, poverty rate (fraction of households below poverty line), income distribution quintiles (pct_low_income, pct_high_income), infrastructure access (pct_piped_water, pct_formal_sewage), and population density per km\u00b2.",
    source: "IBGE — Brazilian Institute of Geography and Statistics",
    sourceUrl: "https://www.ibge.gov.br/",
    date: "Census 2010 (latest full census with neighbourhood-level socioeconomic data)",
    resolution: "Neighbourhood polygons (setor censitario aggregated)",
    coverage: "99 Porto Alegre neighbourhoods",
    notes: "Licensed under CC BY 4.0. Poverty rate ranges from 0 to 1. The 2022 census microdata for Porto Alegre neighbourhoods is pending release by IBGE.",
  },
  {
    id: "ibge_settlements",
    methodology: "Informal settlement (aglomerado subnormal) boundaries identified by IBGE through satellite imagery interpretation and field verification. Each polygon represents a cluster of housing units characterized by irregular land tenure, absence of formal property titles, and/or deficient urban infrastructure.",
    source: "IBGE — Brazilian Institute of Geography and Statistics",
    sourceUrl: "https://www.ibge.gov.br/",
    date: "2022 Census preliminary boundaries (released 2024)",
    resolution: "Vector polygon boundaries at census tract resolution",
    coverage: "125 informal settlement polygons across Porto Alegre",
    notes: "Licensed under CC BY 4.0. Informal settlements are areas of particular social vulnerability and are important for targeting nature-based interventions that improve resilience.",
  },
  {
    id: "oef_dynamic_world",
    methodology: "Land use classification tiles from Google Dynamic World, a near-real-time 10m land use/land cover dataset derived from Sentinel-2 imagery. Pre-rendered visual tiles served from OEF S3 bucket.",
    source: "Google Dynamic World via OpenEarth Foundation",
    sourceUrl: "https://dynamicworld.app/",
    date: "2023 composite",
    resolution: "10 meters per pixel",
    coverage: "Porto Alegre metropolitan area",
    notes: "9-class land cover: water, trees, grass, flooded vegetation, crops, shrub/scrub, built area, bare ground, snow/ice. Tiles pre-generated for web map display.",
  },
  {
    id: "oef_solar_tiles",
    methodology: "Pre-rendered solar photovoltaic output potential tiles from the Global Solar Atlas v2. Pixel values represent PVOUT (kWh/kWp/day) encoded as visual colour tiles for web map overlay.",
    source: "Global Solar Atlas v2 — World Bank / Solargis via OpenEarth Foundation",
    sourceUrl: "https://globalsolaratlas.info/",
    date: "Long-term average (1994-2018)",
    resolution: "250 meters per pixel",
    coverage: "Porto Alegre metropolitan area",
    notes: "Visual tile layer showing spatial variation in solar energy potential. For neighbourhood-level statistics, use the Solar Potential vector layer.",
  },
  {
    id: "oef_slope",
    methodology: "Slope raster derived from Copernicus DEM GLO-30. Computed as the maximum rate of elevation change between each cell and its neighbors.",
    source: "Derived from Copernicus DEM — OpenEarth Foundation",
    date: "2021",
    resolution: "30 meters",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_flow_accumulation",
    methodology: "Flow accumulation raster computed using D8 algorithm on Copernicus DEM. Each pixel value represents the number of upstream cells that drain through it.",
    source: "Derived from Copernicus DEM — OpenEarth Foundation",
    date: "2021",
    resolution: "30 meters",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available. Grid-level flow accumulation is already computed and used in flood risk scoring.",
  },
  {
    id: "oef_canopy_cover",
    methodology: "Tree canopy cover percentage derived from high-resolution satellite imagery and validated against ground truth data.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "10-30 meters",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_flood_hazard",
    methodology: "Flood hazard mapping combining hydrological modeling with terrain analysis to identify areas susceptible to riverine and pluvial flooding.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_heat_hazard",
    methodology: "Urban heat island hazard mapping using land surface temperature from satellite thermal bands, combined with urban morphology indicators.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_exposure",
    methodology: "Population and asset exposure scoring combining population density, building footprints, and critical infrastructure locations.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_cooling",
    methodology: "Urban cooling capacity index based on vegetation coverage, water body proximity, and urban morphology factors that contribute to natural cooling.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_composite_risk",
    methodology: "Composite multi-hazard risk index combining flood, heat, and landslide risk scores with exposure weighting.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
  {
    id: "oef_opportunity_zones",
    methodology: "Nature-based solution opportunity zone identification using multi-criteria analysis of risk hotspots, available land, and ecological connectivity.",
    source: "OpenEarth Foundation",
    date: "TBD",
    resolution: "TBD",
    coverage: "Porto Alegre municipality",
    notes: "Coming soon — tile layer not yet available.",
  },
];

export default function DataPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
      <header
        data-testid="header-data"
        className="h-14 flex items-center px-4 sticky top-0 z-50"
        style={{ backgroundColor: "#001fa8" }}
      >
        <div className="flex items-center gap-3 w-full">
          <Link href="/">
            <a data-testid="link-back-map" className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </a>
          </Link>
          <img src="/oef-logo.svg" alt="OpenEarth" className="w-7 h-7" />
          <span className="text-white text-sm font-medium tracking-wide">
            Data Sources & Methodology
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <p data-testid="text-data-intro" className="text-zinc-400 text-sm mb-8 max-w-3xl">
          Documentation of all evidence layers used in the Project Preparation Data Layers tool.
          Each layer includes its data source, methodology, temporal coverage, spatial resolution, and geographic extent.
        </p>

        {LAYER_SECTIONS.map((section) => {
          const sectionGroups = LAYER_GROUPS.filter((g) => g.section === section.id);
          const isOef = section.id === "oef_catalog";

          return (
            <section key={section.id} className="mb-12">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-6">
                {isOef ? (
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded"
                    style={{ backgroundColor: 'rgba(0,31,168,0.25)', color: '#6B8CFF' }}
                  >
                    {section.label}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    {section.label}
                  </span>
                )}
                <div
                  className="flex-1 h-px"
                  style={isOef ? { backgroundColor: 'rgba(0,31,168,0.4)' } : { backgroundColor: 'rgba(255,255,255,0.07)' }}
                />
              </div>

              {/* Groups inside this section */}
              {sectionGroups.map((group) => {
                const groupLayers = LAYER_CONFIGS.filter((l) => l.group === group.id);
                if (groupLayers.length === 0) return null;

                return (
                  <div key={group.id} className="mb-8">
                    <h2
                      data-testid={`heading-group-${group.id}`}
                      className="text-xs font-semibold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2 mb-4"
                    >
                      {group.label}
                    </h2>

                    <div className="space-y-4">
                      {groupLayers.map((layer) => {
                        const info = LAYER_DATA_INFO.find((d) => d.id === layer.id);
                        const Icon = layer.icon;

                        return (
                          <div
                            key={layer.id}
                            data-testid={`card-layer-${layer.id}`}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: layer.color + "22" }}
                              >
                                <Icon className="w-4 h-4" style={{ color: layer.color }} />
                              </div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-white">{layer.name}</h3>
                                {!layer.available && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium">
                                    Coming Soon
                                  </span>
                                )}
                              </div>
                            </div>

                            {info ? (
                              <div className="space-y-3 text-sm">
                                <div>
                                  <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Methodology</dt>
                                  <dd className="text-zinc-300 leading-relaxed">{info.methodology}</dd>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Source</dt>
                                    <dd className="text-zinc-300 text-xs">
                                      {info.sourceUrl ? (
                                        <a
                                          href={info.sourceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          data-testid={`link-source-${layer.id}`}
                                          className="hover:text-blue-400 transition-colors inline-flex items-center gap-1"
                                        >
                                          {info.source}
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ) : (
                                        info.source
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Date</dt>
                                    <dd className="text-zinc-300 text-xs">{info.date}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Resolution</dt>
                                    <dd className="text-zinc-300 text-xs">{info.resolution}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Coverage</dt>
                                    <dd className="text-zinc-300 text-xs">{info.coverage}</dd>
                                  </div>
                                </div>

                                {info.notes && (
                                  <div>
                                    <dt className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">Notes</dt>
                                    <dd className="text-zinc-400 text-xs leading-relaxed">{info.notes}</dd>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-zinc-500 text-xs">Documentation pending.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </main>
    </div>
  );
}

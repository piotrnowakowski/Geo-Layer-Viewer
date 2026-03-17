import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LayerState } from "@/data/layer-configs";

// ── Legend type system ────────────────────────────────────────────────────────

interface GradientDef {
  kind: "gradient";
  colors: string[];
  labels: [string, string];
}
interface CategoricalDef {
  kind: "categorical";
  items: { color: string; label: string }[];
}
interface LineDef  { kind: "line"  }
interface PointDef { kind: "point" }
interface SolidDef { kind: "solid" }

type LegendDef = GradientDef | CategoricalDef | LineDef | PointDef | SolidDef;

// ── OEF CUSTOM HAZARD COLORMAP (pixel-sampled) ────────────────────────────────
//
// ALL OEF hazard tile layers share this single custom scale.
// Confirmed by sampling CHIRPS, ERA5, HWM, and FRI tiles.
// nodata sentinel = #b40000 (confirmed in every tile — excluded from scale).
//
//  t=0.0  orange-red  #c82500  (200,37,0)    LOW value / least hazardous
//  t=0.15 orange      #f67b00  (246,123,0)
//  t=0.35 yellow      #ffdc54  (255,220,84)
//  t=0.45 lt yel-grn  #d1f090  (209,240,144)
//  t=0.55 mint green  #8fdab3  (143,218,179)
//  t=0.65 cyan        #46c1da  (70,193,218)
//  t=0.80 sky blue    #028bda  (2,139,218)
//  t=1.0  dark navy   #08306b  (8,48,107)    HIGH value / most hazardous
//
// Source: pixel extraction from 9 CHIRPS tiles, ERA5 TXx/TNx/TX90p tiles,
//         HWM tile, and FRI tile — all produced avg colour-distance < 6.0
//         against the above scale vs 47–60 for any standard matplotlib colourmap.

const OEF_HAZARD = ['#c82500','#f67b00','#ffdc54','#d1f090','#8fdab3','#46c1da','#028bda','#08306b'];

// Helper to make a gradient def with the OEF custom scale
function oef(lo: string, hi: string): GradientDef {
  return { kind: "gradient", colors: OEF_HAZARD, labels: [lo, hi] };
}

// ── Legend definitions ────────────────────────────────────────────────────────

const LEGEND_DEF: Record<string, LegendDef> = {

  // ── Derived risk grid (real measured values from 1 216-cell GeoJSON cache) ──
  grid_flood:     { kind: "gradient", colors: ["#dbeafe","#93c5fd","#60a5fa","#3b82f6","#1e40af"], labels: ["0.11", "0.56 score"] },
  grid_heat:      { kind: "gradient", colors: ["#fee2e2","#fca5a5","#f87171","#dc2626","#991b1b"], labels: ["0.00", "0.88 score"] },
  grid_landslide: { kind: "gradient", colors: ["#fef3c7","#fde68a","#fbbf24","#ca8a04","#78350f"], labels: ["0.17", "0.49 score"] },

  // ── IBGE & social (real measured values) ────────────────────────────────────
  ibge_census:    { kind: "gradient", colors: ["#ede9fe","#c084fc","#a855f7","#7e22ce","#3b0764"], labels: ["2%", "35% poverty rate"] },
  ibge_settlements: { kind: "solid" },

  // ── Solar (real PVOUT values from 99 neighbourhoods) ───────────────────────
  solar_potential:  { kind: "gradient", colors: ["#fef3c7","#fde68a","#fbbf24","#f59e0b","#b45309"], labels: ["4.0", "4.1 kWh/kWp/d"] },

  // ── Geometry layers ─────────────────────────────────────────────────────────
  rivers:         { kind: "line"  },
  transit_routes: { kind: "line"  },
  transit_stops:  { kind: "point" },

  sites_parks:       { kind: "point" },
  sites_schools:     { kind: "point" },
  sites_hospitals:   { kind: "point" },
  sites_wetlands:    { kind: "point" },
  sites_sports:      { kind: "point" },
  sites_social:      { kind: "point" },
  sites_vacant:      { kind: "solid" },
  sites_flood_zones: { kind: "solid" },
  sites_flood2024:   { kind: "solid" },

  // ── OEF tile — Land Use & Urban ─────────────────────────────────────────────
  // Dynamic World: categorical colours confirmed by sampling zoom-10 tiles.
  oef_dynamic_world: {
    kind: "categorical",
    items: [
      { color: "#62b0cc", label: "Water"        },   // #62b0cc sampled
      { color: "#488c5f", label: "Trees"        },   // #488c5f sampled
      { color: "#98b982", label: "Grass"        },   // #98b982 sampled
      { color: "#cdb982", label: "Crops"        },   // #cdb982 sampled
      { color: "#b45f55", label: "Built area"   },   // #b45f55 sampled
      { color: "#afa89e", label: "Bare ground"  },   // #afa89e sampled
    ],
  },
  // GHSL built-up: OEF custom gradient (orange=sparse, navy=dense)
  oef_ghsl_built_up:      { kind: "gradient", colors: OEF_HAZARD, labels: ["0%", "100% built-up"] },
  // GHSL urbanisation: 3-class categorical per Degree of Urbanisation spec
  oef_ghsl_urbanization: {
    kind: "categorical",
    items: [
      { color: "#ffdc54", label: "Peri-urban"   },
      { color: "#46c1da", label: "Semi-dense"   },
      { color: "#08306b", label: "Urban centre" },
    ],
  },
  oef_viirs_nightlights:  { kind: "gradient", colors: OEF_HAZARD, labels: ["Dark", "Bright (radiance)"] },
  oef_opportunity_zones:  { kind: "solid" },

  // ── OEF tile — Environment & Ecology ────────────────────────────────────────
  oef_solar_tiles:        { kind: "gradient", colors: ["#fef3c7","#fde68a","#fbbf24","#f59e0b","#b45309"], labels: ["4.0", "4.1 kWh/kWp/d"] },
  oef_modis_ndvi:         { kind: "gradient", colors: ["#7f3b08","#e0ad68","#f7f7f7","#a8ddb5","#084081"], labels: ["-0.2", "1.0 NDVI"] },
  oef_hansen_forest:      { kind: "gradient", colors: ["#ffffcc","#c7e9b4","#7fcdbb","#2c7fb8","#253494"], labels: ["2001", "2023 loss year"] },
  oef_canopy_cover:       { kind: "gradient", colors: ["#f7fcf5","#c7e9c0","#74c476","#238b45","#00441b"], labels: ["0%", "100% canopy"] },
  oef_heat_hazard:        oef("Low", "High heat hazard"),
  oef_cooling:            { kind: "gradient", colors: ["#f7fcf5","#c7e9c0","#74c476","#238b45","#00441b"], labels: ["Low", "High cooling"] },
  oef_composite_risk:     oef("Low risk", "High risk"),

  // ── OEF tile — Population ────────────────────────────────────────────────────
  oef_ghsl_population:    { kind: "gradient", colors: ["#f7f0fa","#d4b9da","#c994c7","#df65b0","#67001f"], labels: ["0", "17 975 /km²"] },
  oef_exposure:           oef("Low exposure", "High exposure"),

  // ── OEF tile — Hydrology & Terrain ──────────────────────────────────────────
  oef_copernicus_dem:     { kind: "gradient", colors: ["#023858","#045a8d","#74add1","#fed976","#a63603"], labels: ["0", "284 m elevation"] },
  oef_merit_elv:          { kind: "gradient", colors: ["#023858","#045a8d","#74add1","#fed976","#a63603"], labels: ["0", "284 m elevation"] },
  oef_merit_upa:          { kind: "gradient", colors: ["#f0f9e8","#a8ddb5","#43a2ca","#0868ac","#022a6b"], labels: ["Small", "Large (km²)"] },
  oef_merit_hydro:        { kind: "gradient", colors: ["#0c2340","#1e6091","#48cae4","#caf0f8","#ffffff"], labels: ["0", "30+ m above drain"] },
  oef_slope:              { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0°", "45°+ slope"] },
  oef_flow_accumulation:  { kind: "gradient", colors: ["#f0f9e8","#bae4bc","#7bccc4","#2b8cbe","#084081"], labels: ["Low", "High flow accum."] },
  oef_flood_hazard:       oef("Low", "High flood hazard"),
  oef_jrc_occurrence:     { kind: "gradient", colors: ["#f0f9e8","#bae4bc","#7bccc4","#2b8cbe","#023858"], labels: ["0%", "100% occurrence"] },
  oef_jrc_seasonality:    { kind: "gradient", colors: ["#f0f9e8","#a8ddb5","#43a2ca","#0868ac","#023858"], labels: ["0", "12 months/yr"] },
  oef_jrc_surface_water: {
    kind: "categorical",
    items: [
      { color: "#023858", label: "Permanent water" },
      { color: "#43a2ca", label: "Seasonal water"  },
      { color: "#a8ddb5", label: "New water"       },
      { color: "#fc8d59", label: "Lost water"      },
    ],
  },
  oef_hansen_treecover:   { kind: "gradient", colors: ["#f7fcf5","#c7e9c0","#74c476","#238b45","#00441b"], labels: ["0%", "100% canopy"] },
  oef_emsn194:            { kind: "gradient", colors: ["#eff8ff","#9ecae1","#3182bd","#08519c","#08306b"], labels: ["0", ">2.0 m depth"] },

  // ── OEF tile — CHIRPS extreme precipitation ──────────────────────────────────
  // Colormap confirmed from pixel sampling (avgDist 6.0 vs 47+ for stdlib maps).
  // Orange (low mm) → Navy (high mm). #b40000 = OEF nodata sentinel (excluded).
  oef_chirps_r90p_2024:   oef("Low R90p", "High R90p (mm)"),
  oef_chirps_r90p_clim:   oef("Low R90p", "High R90p (mm)"),
  oef_chirps_r95p_2024:   oef("Low R95p", "High R95p (mm)"),
  oef_chirps_r95p_clim:   oef("Low R95p", "High R95p (mm)"),
  oef_chirps_r99p_2024:   oef("Low R99p", "High R99p (mm)"),
  oef_chirps_r99p_clim:   oef("Low R99p", "High R99p (mm)"),
  oef_chirps_rx1day_2024: oef("Low Rx1day", "High Rx1day (mm)"),
  oef_chirps_rx1day_clim: oef("Low Rx1day", "High Rx1day (mm)"),
  oef_chirps_rx5day_2024: oef("Low Rx5day", "High Rx5day (mm)"),
  oef_chirps_rx5day_clim: oef("Low Rx5day", "High Rx5day (mm)"),

  // ── OEF tile — ERA5-Land extreme temperature ─────────────────────────────────
  // Same OEF custom colormap — confirmed from pixel sampling ERA5 tiles.
  // Orange = cooler/less extreme; Navy = hotter/more extreme.
  oef_era5_tnx_2024:   oef("Low TNx (°C)", "High TNx (°C)"),
  oef_era5_tnx_clim:   oef("Low TNx (°C)", "High TNx (°C)"),
  oef_era5_tx90p_2024: oef("Low TX90p (%)", "High TX90p (%)"),
  oef_era5_tx90p_clim: oef("Low TX90p (%)", "High TX90p (%)"),
  oef_era5_tx99p_2024: oef("Low TX99p (%)", "High TX99p (%)"),
  oef_era5_tx99p_clim: oef("Low TX99p (%)", "High TX99p (%)"),
  oef_era5_txx_2024:   oef("Low TXx (°C)",  "High TXx (°C)"),
  oef_era5_txx_clim:   oef("Low TXx (°C)",  "High TXx (°C)"),

  // ── OEF tile — Heatwave Magnitude (observed + projections) ──────────────────
  // Same OEF scale. Porto Alegre 2024 tile = 100 % dark navy (#08306b) →
  // the city sits at the extreme high end of the HWM scale.
  oef_hwm_2024:      oef("Low HWM", "High HWM (°C·days)"),
  oef_hwm_clim:      oef("Low HWM", "High HWM (°C·days)"),
  oef_hwm_2030s_245: oef("Low HWM", "High SSP2-4.5"),
  oef_hwm_2030s_585: oef("Low HWM", "High SSP5-8.5"),
  oef_hwm_2050s_585: oef("Low HWM", "High SSP5-8.5"),
  oef_hwm_2100s_585: oef("Low HWM", "High SSP5-8.5"),

  // ── OEF tile — Flood Risk Index (observed + projections) ─────────────────────
  // FRI also uses the OEF custom scale. Porto Alegre only shows the blue-cyan
  // portion (medium-to-high risk) since the city has no low-risk zones.
  oef_fri_2024:      oef("Low risk", "High risk (0→1)"),
  oef_fri_2030s_245: oef("Low risk", "High SSP2-4.5"),
  oef_fri_2030s_585: oef("Low risk", "High SSP5-8.5"),
  oef_fri_2050s_245: oef("Low risk", "High SSP2-4.5"),
  oef_fri_2050s_585: oef("Low risk", "High SSP5-8.5"),
  oef_fri_2100s_245: oef("Low risk", "High SSP2-4.5"),
  oef_fri_2100s_585: oef("Low risk", "High SSP5-8.5"),

  // ── VIIRS I5 brightness temperature ──────────────────────────────────────────
  ref_viirs_lst: { kind: "gradient", colors: ["#313695","#74add1","#ffffbf","#f46d43","#a50026"], labels: ["25°C", "45°C surface"] },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function GradientBar({ colors, labels, unit }: { colors: string[]; labels: [string, string]; unit?: string }) {
  return (
    <div className="mt-1.5 ml-5">
      <div className="flex items-center gap-1.5">
        <div
          className="h-1.5 rounded-sm flex-1"
          style={{ background: `linear-gradient(to right, ${colors.join(", ")})` }}
        />
        {unit && (
          <span className="text-[8px] text-emerald-400 font-medium shrink-0 leading-none">
            {unit}
          </span>
        )}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-zinc-500">{labels[0]}</span>
        <span className="text-[9px] text-zinc-500">{labels[1]}</span>
      </div>
    </div>
  );
}

function CategoricalItems({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-1 ml-5 flex flex-col gap-0.5">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/20"
            style={{ backgroundColor: color }}
          />
          <span className="text-[9px] text-zinc-500 leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}

function LayerRow({ layer }: { layer: LayerState }) {
  const def: LegendDef = LEGEND_DEF[layer.id] ?? { kind: "solid" };
  const { color } = layer;
  const hasValues = layer.hasValueTiles === true;
  const unit = layer.valueEncoding?.unit;

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        {def.kind === "line" ? (
          <div className="w-4 h-0.5 rounded shrink-0" style={{ backgroundColor: color }} />
        ) : def.kind === "point" ? (
          <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30" style={{ backgroundColor: color }} />
        ) : (
          <div className="w-3 h-3 rounded-sm shrink-0 border border-black/30" style={{ backgroundColor: color }} />
        )}
        <span className="text-[11px] text-zinc-200 leading-tight truncate flex-1">
          {layer.name}
        </span>
        <div
          title={hasValues ? (unit ? `Values: ${unit}` : "Values available") : "Visual only"}
          className={[
            "shrink-0 w-1.5 h-1.5 rounded-full",
            hasValues
              ? "bg-emerald-400"
              : (layer.source === "tiles" ? "border border-zinc-600 bg-transparent" : "hidden"),
          ].join(" ")}
        />
      </div>

      {def.kind === "gradient"    && <GradientBar colors={def.colors} labels={def.labels} unit={hasValues ? unit : undefined} />}
      {def.kind === "categorical" && <CategoricalItems items={def.items} />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  layers: LayerState[];
}

export default function LegendPanel({ layers }: Props) {
  const [expanded, setExpanded] = useState(true);

  const activeLayers = layers.filter((l) => l.enabled && l.available);
  if (activeLayers.length === 0) return null;

  return (
    <div
      className="site-explorer-panel absolute bottom-0 right-4 z-[1001] w-52 rounded-t-xl overflow-hidden flex flex-col"
      style={{
        backgroundColor: "rgba(12, 12, 16, 0.93)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderBottom: "none",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {expanded && (
        <div
          className="px-3 pt-2 pb-0.5 overflow-y-auto"
          style={{ maxHeight: "min(60vh, 440px)" }}
        >
          <div className="divide-y divide-zinc-800/50">
            {activeLayers.map((layer) => (
              <LayerRow key={layer.id} layer={layer} />
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-2 flex items-center gap-3 border-t border-zinc-800/60 pt-1.5">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[8px] text-zinc-500">Values accessible</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full border border-zinc-600" />
            <span className="text-[8px] text-zinc-500">Visual only</span>
          </div>
        </div>
      )}

      <button
        data-testid="button-legend-toggle"
        onClick={() => setExpanded((v) => !v)}
        className="w-full h-10 flex items-center justify-between px-3 shrink-0 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">Legend</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium text-zinc-400"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          >
            {activeLayers.length}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
        )}
      </button>
    </div>
  );
}

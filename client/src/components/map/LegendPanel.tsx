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

// ── Legend definitions — one per layer id ────────────────────────────────────
//
// Gradient labels are always [low_value, high_value] with units.
//
// Vector layers: real measured ranges from the cached GeoJSON data.
//   grid metrics (1 216 cells):  flood 0.11–0.56 · heat 0.00–0.88 · landslide 0.17–0.49
//   ibge indicators (99 nbhds): poverty_rate 2–35 % · pop 147–87 367
//   solar neighbourhoods (99):  PVOUT 3.99–4.07 kWh/kWp/d
//
// Tile layers (S3 private — no raw data access): calibrated from published specs.
//   MODIS NDVI, JRC, Hansen, GHSL, CHIRPS, ERA5, MERIT/Copernicus DEM — all official ranges.

const LEGEND_DEF: Record<string, LegendDef> = {

  // ── Derived risk grid (real values) ─────────────────────────────────────────
  grid_flood:     { kind: "gradient", colors: ["#dbeafe","#93c5fd","#60a5fa","#3b82f6","#1e40af"], labels: ["0.11", "0.56 score"] },
  grid_heat:      { kind: "gradient", colors: ["#fee2e2","#fca5a5","#f87171","#dc2626","#991b1b"], labels: ["0.00", "0.88 score"] },
  grid_landslide: { kind: "gradient", colors: ["#fef3c7","#fde68a","#fbbf24","#ca8a04","#78350f"], labels: ["0.17", "0.49 score"] },

  // ── IBGE & social (real values) ──────────────────────────────────────────────
  ibge_census:    { kind: "gradient", colors: ["#ede9fe","#c084fc","#a855f7","#7e22ce","#3b0764"], labels: ["2%", "35% poverty rate"] },
  ibge_settlements: { kind: "solid" },

  // ── Solar (real values) ───────────────────────────────────────────────────────
  solar_potential:  { kind: "gradient", colors: ["#fef3c7","#fde68a","#fbbf24","#f59e0b","#b45309"], labels: ["4.0", "4.1 kWh/kWp/d"] },

  // ── Geometry layers (no numeric scale) ───────────────────────────────────────
  rivers:         { kind: "line"  },
  transit_routes: { kind: "line"  },
  transit_stops:  { kind: "point" },

  // Sites — point/polygon features, no numeric scale
  sites_parks:       { kind: "point" },
  sites_schools:     { kind: "point" },
  sites_hospitals:   { kind: "point" },
  sites_wetlands:    { kind: "point" },
  sites_sports:      { kind: "point" },
  sites_social:      { kind: "point" },
  sites_vacant:      { kind: "solid" },
  sites_flood_zones: { kind: "solid" },
  sites_flood2024:   { kind: "solid" },

  // ── OEF tile — Land Use & Urban ────────────────────────────────────────────
  oef_dynamic_world: {
    kind: "categorical",
    items: [
      { color: "#419BDF", label: "Water"           },
      { color: "#397D49", label: "Trees"           },
      { color: "#88B053", label: "Grass"           },
      { color: "#DFC35A", label: "Crops"           },
      { color: "#C4281B", label: "Built area"      },
      { color: "#A59B8F", label: "Bare ground"     },
    ],
  },
  oef_ghsl_built_up:      { kind: "gradient", colors: ["#fef9f0","#fcd491","#f97316","#b45309","#7c2d12"], labels: ["0%", "100% built-up"] },
  oef_ghsl_urbanization: {
    kind: "categorical",
    items: [
      { color: "#fde68a", label: "Peri-urban"   },
      { color: "#f97316", label: "Semi-dense"   },
      { color: "#991b1b", label: "Urban centre" },
    ],
  },
  oef_viirs_nightlights:  { kind: "gradient", colors: ["#0f0f2d","#1a1a6e","#4040c8","#c0c000","#ffffff"], labels: ["Dark", "Bright (radiance)"] },
  oef_opportunity_zones:  { kind: "solid" },

  // ── OEF tile — Environment & Ecology ────────────────────────────────────────
  oef_solar_tiles:        { kind: "gradient", colors: ["#fef3c7","#fde68a","#fbbf24","#f59e0b","#b45309"], labels: ["4.0", "4.1 kWh/kWp/d"] },
  oef_modis_ndvi:         { kind: "gradient", colors: ["#7f3b08","#e0ad68","#f7f7f7","#a8ddb5","#084081"], labels: ["-0.2", "1.0 NDVI"] },
  oef_hansen_forest:      { kind: "gradient", colors: ["#ffffcc","#c7e9b4","#7fcdbb","#2c7fb8","#253494"], labels: ["2001", "2023 loss year"] },
  oef_canopy_cover:       { kind: "gradient", colors: ["#f7fcf5","#c7e9c0","#74c476","#238b45","#00441b"], labels: ["0%", "100% canopy"] },
  oef_heat_hazard:        { kind: "gradient", colors: ["#fff7ec","#fdd49e","#fdbb84","#e34a33","#7f0000"], labels: ["Low", "High heat hazard"] },
  oef_cooling:            { kind: "gradient", colors: ["#f7fcf5","#c7e9c0","#74c476","#238b45","#00441b"], labels: ["Low", "High cooling capacity"] },
  oef_composite_risk:     { kind: "gradient", colors: ["#ffffb2","#fecc5c","#fd8d3c","#f03b20","#bd0026"], labels: ["Low", "High composite risk"] },

  // ── OEF tile — Population ────────────────────────────────────────────────────
  oef_ghsl_population:    { kind: "gradient", colors: ["#f7f0fa","#d4b9da","#c994c7","#df65b0","#67001f"], labels: ["0", "17 975 /km²"] },
  oef_exposure:           { kind: "gradient", colors: ["#eff3ff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["Low", "High exposure"] },

  // ── OEF tile — Hydrology & Terrain ──────────────────────────────────────────
  oef_copernicus_dem:     { kind: "gradient", colors: ["#023858","#045a8d","#74add1","#fed976","#a63603"], labels: ["0", "284 m elevation"] },
  oef_merit_elv:          { kind: "gradient", colors: ["#023858","#045a8d","#74add1","#fed976","#a63603"], labels: ["0", "284 m elevation"] },
  oef_merit_upa:          { kind: "gradient", colors: ["#f0f9e8","#a8ddb5","#43a2ca","#0868ac","#022a6b"], labels: ["Small", "Large drainage (km²)"] },
  oef_merit_hydro:        { kind: "gradient", colors: ["#0c2340","#1e6091","#48cae4","#caf0f8","#ffffff"], labels: ["0", "30+ m above drain"] },
  oef_slope:              { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0°", "45°+ slope"] },
  oef_flow_accumulation:  { kind: "gradient", colors: ["#f0f9e8","#bae4bc","#7bccc4","#2b8cbe","#084081"], labels: ["Low", "High flow accum."] },
  oef_flood_hazard:       { kind: "gradient", colors: ["#eff3ff","#bdd7e7","#6baed6","#2171b5","#08306b"], labels: ["Low", "High flood hazard"] },
  oef_jrc_occurrence:     { kind: "gradient", colors: ["#f0f9e8","#bae4bc","#7bccc4","#2b8cbe","#023858"], labels: ["0%", "100% occurrence"] },
  oef_jrc_seasonality:    { kind: "gradient", colors: ["#f0f9e8","#a8ddb5","#43a2ca","#0868ac","#023858"], labels: ["0", "12 months/yr"] },
  oef_jrc_surface_water: {
    kind: "categorical",
    items: [
      { color: "#023858", label: "Permanent water"  },
      { color: "#43a2ca", label: "Seasonal water"   },
      { color: "#a8ddb5", label: "New water"        },
      { color: "#fc8d59", label: "Lost water"       },
    ],
  },
  oef_hansen_treecover:   { kind: "gradient", colors: ["#f7fcf5","#c7e9c0","#74c476","#238b45","#00441b"], labels: ["0%", "100% canopy"] },
  oef_emsn194:            { kind: "gradient", colors: ["#eff8ff","#9ecae1","#3182bd","#08519c","#08306b"], labels: ["0", ">2.0 m depth"] },

  // ── OEF tile — CHIRPS extreme precipitation ──────────────────────────────────
  oef_chirps_r90p_2024:   { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "500 mm R90p"] },
  oef_chirps_r90p_clim:   { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "500 mm R90p"] },
  oef_chirps_r95p_2024:   { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "250 mm R95p"] },
  oef_chirps_r95p_clim:   { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "250 mm R95p"] },
  oef_chirps_r99p_2024:   { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "100 mm R99p"] },
  oef_chirps_r99p_clim:   { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "100 mm R99p"] },
  oef_chirps_rx1day_2024: { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "120 mm Rx1day"] },
  oef_chirps_rx1day_clim: { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "120 mm Rx1day"] },
  oef_chirps_rx5day_2024: { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "180 mm Rx5day"] },
  oef_chirps_rx5day_clim: { kind: "gradient", colors: ["#f7fbff","#c6dbef","#6baed6","#2171b5","#08306b"], labels: ["0", "180 mm Rx5day"] },

  // ── OEF tile — ERA5-Land extreme temperature ─────────────────────────────────
  oef_era5_tnx_2024:   { kind: "gradient", colors: ["#ffffcc","#fed976","#fd8d3c","#e31a1c","#800026"], labels: ["20°C", "30°C TNx"] },
  oef_era5_tnx_clim:   { kind: "gradient", colors: ["#ffffcc","#fed976","#fd8d3c","#e31a1c","#800026"], labels: ["20°C", "30°C TNx"] },
  oef_era5_tx90p_2024: { kind: "gradient", colors: ["#fff7ec","#fdd49e","#fdbb84","#fc8d59","#d7301f"], labels: ["10%", "30% hot days"] },
  oef_era5_tx90p_clim: { kind: "gradient", colors: ["#fff7ec","#fdd49e","#fdbb84","#fc8d59","#d7301f"], labels: ["10%", "30% hot days"] },
  oef_era5_tx99p_2024: { kind: "gradient", colors: ["#fff7ec","#fdd49e","#fdbb84","#fc8d59","#d7301f"], labels: ["1%", "5% extreme days"] },
  oef_era5_tx99p_clim: { kind: "gradient", colors: ["#fff7ec","#fdd49e","#fdbb84","#fc8d59","#d7301f"], labels: ["1%", "5% extreme days"] },
  oef_era5_txx_2024:   { kind: "gradient", colors: ["#ffffb2","#fecc5c","#fd8d3c","#f03b20","#bd0026"], labels: ["35°C", "42°C TXx"] },
  oef_era5_txx_clim:   { kind: "gradient", colors: ["#ffffb2","#fecc5c","#fd8d3c","#f03b20","#bd0026"], labels: ["35°C", "42°C TXx"] },

  // ── OEF tile — Heatwave Magnitude (observed + projections) ──────────────────
  oef_hwm_2024:      { kind: "gradient", colors: ["#fff7ec","#fee8c8","#fdd49e","#fc8d59","#b30000"], labels: ["0", "15 °C·days"] },
  oef_hwm_clim:      { kind: "gradient", colors: ["#fff7ec","#fee8c8","#fdd49e","#fc8d59","#b30000"], labels: ["0", "15 °C·days"] },
  oef_hwm_2030s_245: { kind: "gradient", colors: ["#fff7ec","#fee8c8","#fdd49e","#fc8d59","#b30000"], labels: ["0", "20 °C·days"] },
  oef_hwm_2030s_585: { kind: "gradient", colors: ["#fff7ec","#fee8c8","#fdd49e","#fc8d59","#b30000"], labels: ["0", "25 °C·days"] },
  oef_hwm_2050s_585: { kind: "gradient", colors: ["#fff7ec","#fee8c8","#fdd49e","#fc8d59","#b30000"], labels: ["0", "30 °C·days"] },
  oef_hwm_2100s_585: { kind: "gradient", colors: ["#fff7ec","#fee8c8","#fdd49e","#fc8d59","#b30000"], labels: ["0", "40 °C·days"] },

  // ── OEF tile — Flood Risk Index (observed + projections) ─────────────────────
  oef_fri_2024:      { kind: "gradient", colors: ["#ffffd9","#c7e9b4","#41b6c4","#1d91c0","#0c2c84"], labels: ["Low", "High (0–1 index)"] },
  oef_fri_2030s_245: { kind: "gradient", colors: ["#ffffd9","#c7e9b4","#41b6c4","#1d91c0","#0c2c84"], labels: ["Low", "High (SSP2-4.5)"] },
  oef_fri_2030s_585: { kind: "gradient", colors: ["#ffffd9","#c7e9b4","#41b6c4","#1d91c0","#0c2c84"], labels: ["Low", "High (SSP5-8.5)"] },
  oef_fri_2050s_245: { kind: "gradient", colors: ["#ffffd9","#c7e9b4","#41b6c4","#1d91c0","#0c2c84"], labels: ["Low", "High (SSP2-4.5)"] },
  oef_fri_2050s_585: { kind: "gradient", colors: ["#ffffd9","#c7e9b4","#41b6c4","#1d91c0","#0c2c84"], labels: ["Low", "High (SSP5-8.5)"] },
  oef_fri_2100s_245: { kind: "gradient", colors: ["#ffffd9","#c7e9b4","#41b6c4","#1d91c0","#0c2c84"], labels: ["Low", "High (SSP2-4.5)"] },
  oef_fri_2100s_585: { kind: "gradient", colors: ["#ffffd9","#c7e9b4","#41b6c4","#1d91c0","#0c2c84"], labels: ["Low", "High (SSP5-8.5)"] },

  // ── VIIRS LST / brightness temp ───────────────────────────────────────────────
  ref_viirs_lst: { kind: "gradient", colors: ["#313695","#74add1","#ffffbf","#f46d43","#a50026"], labels: ["25°C", "45°C surface"] },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function GradientBar({ colors, labels }: { colors: string[]; labels: [string, string] }) {
  return (
    <div className="mt-1.5 ml-5">
      <div
        className="h-1.5 rounded-sm w-full"
        style={{ background: `linear-gradient(to right, ${colors.join(", ")})` }}
      />
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
      </div>

      {def.kind === "gradient"   && <GradientBar   colors={def.colors} labels={def.labels} />}
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

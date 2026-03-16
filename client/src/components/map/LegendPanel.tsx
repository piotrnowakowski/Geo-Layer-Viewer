import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LayerState } from "@/data/layer-configs";

// ── Per-layer legend definitions ─────────────────────────────────────────────
interface GradientDef {
  kind: "gradient";
  colors: string[];
  labels: [string, string];
}
interface LineDef  { kind: "line"  }
interface PointDef { kind: "point" }
interface SolidDef { kind: "solid" }

type LegendDef = GradientDef | LineDef | PointDef | SolidDef;

const LEGEND_DEF: Record<string, LegendDef> = {
  // Risk analysis — gradient scales
  grid_flood:      { kind: "gradient", colors: ["#dbeafe","#93c5fd","#60a5fa","#3b82f6","#1e40af"], labels: ["Low","High risk"]       },
  grid_heat:       { kind: "gradient", colors: ["#fee2e2","#fca5a5","#f87171","#dc2626","#991b1b"], labels: ["Low","High risk"]       },
  grid_landslide:  { kind: "gradient", colors: ["#fef3c7","#eab308","#ca8a04","#a16207","#78350f"], labels: ["Low","High risk"]       },
  solar_potential: { kind: "gradient", colors: ["#fef3c7","#fbbf24","#f59e0b","#d97706","#b45309"], labels: ["3.8","4.2+ kWh/kWp/d"] },
  ibge_census:     { kind: "gradient", colors: ["#f3e8ff","#c084fc","#a855f7","#7e22ce","#581c87"], labels: ["Low","High poverty"]    },
  // Line features
  rivers:          { kind: "line"  },
  transit_routes:  { kind: "line"  },
  // Point markers
  transit_stops:   { kind: "point" },
  sites_parks:     { kind: "point" },
  sites_schools:   { kind: "point" },
  sites_hospitals: { kind: "point" },
  sites_wetlands:  { kind: "point" },
  sites_sports:    { kind: "point" },
  sites_social:    { kind: "point" },
  sites_vacant:    { kind: "point" },
  // Everything else defaults to solid swatch (all OEF tile layers, ibge_settlements, sites_flood*, etc.)
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

function LayerRow({ layer }: { layer: LayerState }) {
  const def: LegendDef = LEGEND_DEF[layer.id] ?? { kind: "solid" };
  const { color } = layer;

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        {/* Swatch */}
        {def.kind === "line" ? (
          <div
            className="w-4 h-0.5 rounded shrink-0"
            style={{ backgroundColor: color }}
          />
        ) : def.kind === "point" ? (
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30"
            style={{ backgroundColor: color }}
          />
        ) : (
          <div
            className="w-3 h-3 rounded-sm shrink-0 border border-black/30"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-[11px] text-zinc-200 leading-tight truncate flex-1">
          {layer.name}
        </span>
      </div>

      {def.kind === "gradient" && (
        <GradientBar colors={def.colors} labels={def.labels} />
      )}
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
      {/* Scrollable content — shown when expanded */}
      {expanded && (
        <div
          className="px-3 pt-2 pb-0.5 overflow-y-auto"
          style={{ maxHeight: "min(52vh, 380px)" }}
        >
          <div className="divide-y divide-zinc-800/50">
            {activeLayers.map((layer) => (
              <LayerRow key={layer.id} layer={layer} />
            ))}
          </div>
        </div>
      )}

      {/* Toggle handle — always visible at bottom */}
      <button
        data-testid="button-legend-toggle"
        onClick={() => setExpanded((v) => !v)}
        className="w-full h-10 flex items-center justify-between px-3 shrink-0 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-300 tracking-wide">
            Legend
          </span>
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

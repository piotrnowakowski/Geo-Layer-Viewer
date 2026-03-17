import { useState, useCallback } from "react";
import { Layers, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAYER_GROUPS, LAYER_SECTIONS, type LayerState } from "@/data/layer-configs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EvidenceDrawerProps {
  layers: LayerState[];
  onToggleLayer: (layerId: string) => void;
}

export default function EvidenceDrawer({ layers, onToggleLayer }: EvidenceDrawerProps) {
  const [expanded, setExpanded] = useState(true);

  const activeCount = layers.filter((l) => l.enabled).length;

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      data-testid="evidence-drawer"
      className={cn(
        "site-explorer-panel",
        "absolute bottom-0 left-0 z-[1001]",
        "w-[80%] max-w-[900px]",
        "bg-zinc-900/95 backdrop-blur-sm",
        "border-t border-r border-zinc-700 rounded-tr-xl",
        "transition-all duration-300 ease-in-out",
        expanded ? "max-h-[440px]" : "max-h-[48px]"
      )}
      onMouseEnter={handleMouseEnter}
      onWheel={handleWheel}
    >
      {/* Header bar */}
      <button
        data-testid="button-toggle-drawer"
        onClick={() => setExpanded(!expanded)}
        className="w-full h-12 flex items-center justify-between px-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-200">Evidence Layers</span>
          {activeCount > 0 && (
            <span
              data-testid="badge-active-layers"
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: 'rgba(0, 31, 168, 0.3)', color: '#6B8CFF' }}
            >
              {activeCount} active
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 overflow-y-auto max-h-[388px]">
          {LAYER_SECTIONS.map((section) => {
            const sectionGroups = LAYER_GROUPS.filter((g) => g.section === section.id);
            const sectionLayers = layers.filter((l) =>
              sectionGroups.some((g) => g.id === l.group)
            );
            if (sectionLayers.length === 0) return null;

            const isOef = section.id === "oef_catalog";

            return (
              <div key={section.id} className="mb-4">
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2.5 mt-1">
                  {isOef ? (
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'rgba(0,31,168,0.25)', color: '#6B8CFF' }}
                    >
                      {section.label}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      {section.label}
                    </span>
                  )}
                  <div className="flex-1 h-px" style={isOef ? { backgroundColor: 'rgba(0,31,168,0.35)' } : { backgroundColor: 'rgba(255,255,255,0.08)' }} />
                </div>

                {/* Sub-groups inside section */}
                <div className="pl-0 space-y-2.5">
                  {sectionGroups.map((group) => {
                    const groupLayers = layers.filter((l) => l.group === group.id);
                    if (groupLayers.length === 0) return null;

                    return (
                      <div key={group.id}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 pl-0.5">
                            {group.label}
                          </span>
                          <div className="flex-1 h-px bg-zinc-800" />
                        </div>
                        <div className="grid grid-cols-6 gap-1.5">
                          {groupLayers.map((layer) => (
                            <LayerButton
                              key={layer.id}
                              layer={layer}
                              onToggle={onToggleLayer}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Dot shown on each layer button indicating data access level:
//   green filled  → value_tile or inline GeoJSON: real numbers decodable
//   grey ring     → visual tiles only: pixels are display colours, not data values
function DataDot({ layer }: { layer: LayerState }) {
  if (!layer.available) return null;
  if (layer.source === "geojson" && !layer.hasValueTiles) return null;

  const hasValues = layer.hasValueTiles === true;
  const unit = layer.valueEncoding?.unit;

  const tooltipText = hasValues
    ? unit
      ? `Real values available · ${unit}`
      : "Real values available"
    : "Visual display only · no numeric values";

  const dot = (
    <div
      data-testid={`dot-data-${layer.id}`}
      className={cn(
        "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full",
        hasValues
          ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.7)]"
          : "border border-zinc-500 bg-transparent"
      )}
    />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 cursor-default">
          {dot}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px] max-w-[160px] text-center">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

function LayerButton({
  layer,
  onToggle,
}: {
  layer: LayerState;
  onToggle: (id: string) => void;
}) {
  const Icon = layer.icon;
  const isAvailable = layer.available;

  const button = (
    <button
      data-testid={`button-layer-${layer.id}`}
      onClick={() => isAvailable && onToggle(layer.id)}
      disabled={!isAvailable}
      className={cn(
        "relative flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all duration-150",
        "text-center min-h-[56px] justify-center",
        layer.enabled
          ? "text-white"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
        !isAvailable && "opacity-40 cursor-not-allowed hover:border-zinc-700 hover:text-zinc-400"
      )}
      style={
        layer.enabled
          ? { backgroundColor: `${layer.color}20`, borderColor: 'rgba(0, 31, 168, 0.5)' }
          : undefined
      }
    >
      {layer.loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <div className="relative">
          <Icon
            className="w-4 h-4"
            style={layer.enabled ? { color: layer.color } : undefined}
          />
          <DataDot layer={layer} />
        </div>
      )}
      <span className="text-[9px] leading-tight font-medium truncate w-full">
        {layer.name}
      </span>
    </button>
  );

  if (!isAvailable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Coming soon
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

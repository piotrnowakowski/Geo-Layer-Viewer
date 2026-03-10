import { useState, useCallback } from "react";
import { Layers, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAYER_CONFIGS, LAYER_GROUPS, type LayerState } from "@/data/layer-configs";
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
        "w-[75%] max-w-[800px]",
        "bg-zinc-900/95 backdrop-blur-sm",
        "border-t border-r border-zinc-700 rounded-tr-xl",
        "transition-all duration-300 ease-in-out",
        expanded ? "max-h-[360px]" : "max-h-[48px]"
      )}
      onMouseEnter={handleMouseEnter}
      onWheel={handleWheel}
    >
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

      {expanded && (
        <div className="px-4 pb-4 overflow-y-auto max-h-[310px]">
          {LAYER_GROUPS.map((group) => {
            const groupLayers = layers.filter((l) => l.group === group.id);
            return (
              <div key={group.id} className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-zinc-700/50" />
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
      )}
    </div>
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
          {layer.source === "tiles" && isAvailable && (
            <div
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400"
            />
          )}
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

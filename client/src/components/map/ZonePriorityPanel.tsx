import { Eye, EyeOff, X, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPOLOGY_COLORS } from "@/data/colors";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Zone {
  zoneId: string;
  name: string;
  typologyLabel: string;
  primaryHazard: string;
  interventionType: string;
  meanFlood: number;
  meanHeat: number;
  meanLandslide: number;
  areaKm2: number;
  cellCount: number;
}

interface ZonePriorityPanelProps {
  zones: Zone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  zonesVisible: boolean;
  onToggleZonesVisibility: () => void;
  onClose: () => void;
}

export default function ZonePriorityPanel({
  zones,
  selectedZoneId,
  onSelectZone,
  zonesVisible,
  onToggleZonesVisibility,
  onClose,
}: ZonePriorityPanelProps) {
  const sortedZones = [...zones].sort((a, b) => {
    const riskA = (a.meanFlood + a.meanHeat + a.meanLandslide) / 3;
    const riskB = (b.meanFlood + b.meanHeat + b.meanLandslide) / 3;
    return riskB - riskA;
  });

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      data-testid="zone-priority-panel"
      className={cn(
        "absolute top-12 right-0 z-[1001]",
        "w-[320px] h-[calc(100%-48px)]",
        "bg-zinc-900/95 backdrop-blur-sm",
        "border-l border-zinc-700",
        "flex flex-col"
      )}
      onWheel={handleWheel}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          <MapPinned className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Intervention Zones</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">
            {zones.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            data-testid="button-toggle-zones-visibility"
            onClick={onToggleZonesVisibility}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {zonesVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            data-testid="button-close-zones-panel"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedZones.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-sm">
              <MapPinned className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No zones available</p>
              <p className="text-xs mt-1">Fetch data to generate zones</p>
            </div>
          )}
          {sortedZones.map((zone) => {
            const compositeRisk = (zone.meanFlood + zone.meanHeat + zone.meanLandslide) / 3;
            const color = TYPOLOGY_COLORS[zone.typologyLabel] || "#6b7280";
            const isSelected = selectedZoneId === zone.zoneId;

            return (
              <button
                key={zone.zoneId}
                data-testid={`button-zone-${zone.zoneId}`}
                onClick={() => onSelectZone(zone.zoneId)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all duration-150",
                  isSelected
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "border-zinc-700/50 hover:border-zinc-600 hover:bg-zinc-800/50"
                )}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <span className="text-xs font-medium text-zinc-200 leading-tight">
                    {zone.name}
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ml-2"
                    style={{
                      backgroundColor: `${color}30`,
                      color: color,
                    }}
                  >
                    {zone.typologyLabel.replace(/_/g, "/")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                  <span>Risk: {(compositeRisk * 100).toFixed(0)}%</span>
                  <span>{zone.areaKm2} km²</span>
                  <span>{zone.cellCount} cells</span>
                </div>
                <div className="flex gap-1 mt-2">
                  <RiskBar label="F" value={zone.meanFlood} color="#3b82f6" />
                  <RiskBar label="H" value={zone.meanHeat} color="#ef4444" />
                  <RiskBar label="L" value={zone.meanLandslide} color="#a16207" />
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function RiskBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 flex items-center gap-1">
      <span className="text-[9px] text-zinc-500 w-2.5">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.max(value * 100, 2)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

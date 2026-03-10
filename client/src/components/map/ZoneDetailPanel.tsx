import { X, CloudRain, Flame, Mountain, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPOLOGY_COLORS, INTERVENTION_COLORS } from "@/data/colors";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { InterventionsData } from "@shared/schema";

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

interface ZoneDetailPanelProps {
  zone: Zone;
  interventions: InterventionsData | null;
  onClose: () => void;
}

export default function ZoneDetailPanel({
  zone,
  interventions,
  onClose,
}: ZoneDetailPanelProps) {
  const typologyColor = TYPOLOGY_COLORS[zone.typologyLabel] || "#6b7280";

  const applicableCategories = interventions
    ? Object.values(interventions.categories).filter((cat) =>
        cat.applicableTypologies.includes(zone.typologyLabel)
      )
    : [];

  const applicableInterventions = interventions
    ? interventions.interventions.filter((int) =>
        applicableCategories.some((cat) => cat.id === int.category)
      )
    : [];

  return (
    <div
      data-testid="zone-detail-panel"
      className={cn(
        "absolute top-16 left-4 z-[1001]",
        "w-[400px] max-h-[calc(100%-120px)]",
        "bg-zinc-900/95 backdrop-blur-sm",
        "border border-zinc-700 rounded-xl",
        "shadow-2xl shadow-black/50",
        "flex flex-col"
      )}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between p-4 border-b border-zinc-700/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MapPinned className="w-4 h-4 shrink-0" style={{ color: typologyColor }} />
            <h2 className="text-sm font-semibold text-zinc-200 truncate">{zone.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${typologyColor}25`,
                color: typologyColor,
              }}
            >
              {zone.typologyLabel.replace(/_/g, " / ")}
            </span>
            <span className="text-[10px] text-zinc-500">
              {zone.areaKm2} km² · {zone.cellCount} cells
            </span>
          </div>
        </div>
        <button
          data-testid="button-close-zone-detail"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">
              Risk Scores
            </h3>
            <div className="space-y-3">
              <RiskScoreRow
                icon={CloudRain}
                label="Flood Risk"
                value={zone.meanFlood}
                color="#3b82f6"
              />
              <RiskScoreRow
                icon={Flame}
                label="Heat Risk"
                value={zone.meanHeat}
                color="#ef4444"
              />
              <RiskScoreRow
                icon={Mountain}
                label="Landslide Risk"
                value={zone.meanLandslide}
                color="#a16207"
              />
            </div>
          </div>

          {applicableCategories.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">
                Applicable Intervention Categories
              </h3>
              <div className="space-y-2">
                {applicableCategories.map((cat) => {
                  const catColor = INTERVENTION_COLORS[cat.id] || "#6b7280";
                  return (
                    <div
                      key={cat.id}
                      data-testid={`card-category-${cat.id}`}
                      className="p-2.5 rounded-lg border border-zinc-700/50 bg-zinc-800/30"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: catColor }}
                        />
                        <span className="text-xs font-medium text-zinc-200">
                          {cat.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-relaxed pl-4">
                        {cat.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {applicableInterventions.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">
                Recommended Interventions
              </h3>
              <div className="space-y-2">
                {applicableInterventions.map((int) => {
                  const catColor = INTERVENTION_COLORS[int.category] || "#6b7280";
                  return (
                    <div
                      key={int.id}
                      data-testid={`card-intervention-${int.id}`}
                      className="p-2.5 rounded-lg border border-zinc-700/50 bg-zinc-800/20"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-zinc-200">
                          {int.name}
                        </span>
                        <div className="flex gap-1">
                          {Object.entries(int.impacts).map(([key, level]) => (
                            level !== "none" && (
                              <span
                                key={key}
                                className={cn(
                                  "text-[8px] px-1 py-0.5 rounded font-medium uppercase",
                                  level === "high"
                                    ? "bg-emerald-900/50 text-emerald-400"
                                    : level === "medium"
                                    ? "bg-yellow-900/50 text-yellow-400"
                                    : "bg-zinc-800 text-zinc-500"
                                )}
                              >
                                {key[0].toUpperCase()}:{level[0].toUpperCase()}
                              </span>
                            )
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-relaxed mb-2">
                        {int.description}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {int.cobenefits.slice(0, 3).map((cb) => (
                          <span
                            key={cb}
                            className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500"
                          >
                            {cb}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function RiskScoreRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-zinc-300">{label}</span>
          <span className="text-[11px] font-medium" style={{ color }}>
            {(value * 100).toFixed(0)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(value * 100, 2)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    </div>
  );
}

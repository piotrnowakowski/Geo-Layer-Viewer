import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MunicipalBuilding } from "@/data/intervention-data";
import { ArrowRight, Building2, School, AlertCircle } from "lucide-react";
import L from "leaflet";

interface MunicipalSolarPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildings: MunicipalBuilding[];
  map: L.Map | null;
  onBuildingSelect?: (building: MunicipalBuilding | null) => void;
}

export default function MunicipalSolarPanel({
  open,
  onOpenChange,
  buildings,
  map,
  onBuildingSelect,
}: MunicipalSolarPanelProps) {
  const [selectedTab, setSelectedTab] = useState<"high" | "medium" | "low">("high");
  const [selectedBuilding, setSelectedBuilding] = useState<MunicipalBuilding | null>(null);

  const buildingsByTier = useMemo(() => {
    return {
      high: buildings.filter((b) => b.priorityTier === "high"),
      medium: buildings.filter((b) => b.priorityTier === "medium"),
      low: buildings.filter((b) => b.priorityTier === "low"),
    };
  }, [buildings]);

  const currentTierBuildings = buildingsByTier[selectedTab];

  const tierStats = useMemo(() => {
    const stats: Record<string, any> = {};
    (["high", "medium", "low"] as const).forEach((tier) => {
      const tierBldgs = buildingsByTier[tier];
      stats[tier] = {
        count: tierBldgs.length,
        totalCapacity: tierBldgs.reduce((sum, b) => sum + b.capacityKwp, 0),
        totalInvestment: tierBldgs.reduce((sum, b) => sum + b.capexBrl, 0),
        totalSavings: tierBldgs.reduce((sum, b) => sum + b.annualSavingsBrl, 0),
        totalCO2: tierBldgs.reduce((sum, b) => sum + b.co2AvoidedTonsPerYear, 0),
      };
    });
    return stats;
  }, [buildingsByTier]);

  const getScoreBadgeColor = (score: number) => {
    if (score > 70) return "bg-green-900 text-green-300";
    if (score > 40) return "bg-yellow-900 text-yellow-300";
    return "bg-red-900 text-red-300";
  };

  const getFloodRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "bg-green-900/30 text-green-300";
      case "moderate":
        return "bg-yellow-900/30 text-yellow-300";
      case "high":
        return "bg-red-900/30 text-red-300";
      default:
        return "bg-gray-900/30 text-gray-300";
    }
  };

  const handleSelectScope = () => {
    const tierLabel = selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1);
    const count = currentTierBuildings.length;
    const capacity = tierStats[selectedTab].totalCapacity.toFixed(1);
    alert(`${tierLabel} Priority scope selected — ${count} buildings, ${capacity} MWp`);
  };

  const handleBuildingClick = (building: MunicipalBuilding) => {
    setSelectedBuilding(building);
    onBuildingSelect?.(building);
    if (map) {
      map.setView([building.lat, building.lng], 14);
    }
  };

  const stats = tierStats[selectedTab];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[650px] bg-gray-900 border-l border-gray-800 p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
          <SheetTitle className="text-white">Municipal Solar Portfolio</SheetTitle>
          <p className="text-gray-400 text-sm mt-1">Select priority buildings for rooftop solar</p>
        </SheetHeader>

        <Tabs
          value={selectedTab}
          onValueChange={(value) => {
            setSelectedTab(value as "high" | "medium" | "low");
            setSelectedBuilding(null);
          }}
          className="flex-1 flex flex-col px-6 pt-6 pb-6 overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-gray-800 p-1 flex-shrink-0">
            <TabsTrigger value="high" className="text-xs">
              High Priority ({buildingsByTier.high.length})
            </TabsTrigger>
            <TabsTrigger value="medium" className="text-xs">
              Medium ({buildingsByTier.medium.length})
            </TabsTrigger>
            <TabsTrigger value="low" className="text-xs">
              Low ({buildingsByTier.low.length})
            </TabsTrigger>
          </TabsList>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6 flex-shrink-0">
            <Card className="p-3 bg-gray-800 border-gray-700">
              <div className="text-xs text-gray-400">Total Capacity</div>
              <div className="text-lg font-bold text-blue-400">{stats.totalCapacity.toFixed(1)} MWp</div>
            </Card>
            <Card className="p-3 bg-gray-800 border-gray-700">
              <div className="text-xs text-gray-400">Investment</div>
              <div className="text-lg font-bold text-blue-400">R${(stats.totalInvestment / 1e6).toFixed(1)}M</div>
            </Card>
            <Card className="p-3 bg-gray-800 border-gray-700">
              <div className="text-xs text-gray-400">Annual Savings</div>
              <div className="text-lg font-bold text-green-400">R${(stats.totalSavings / 1e6).toFixed(1)}M/yr</div>
            </Card>
            <Card className="p-3 bg-gray-800 border-gray-700">
              <div className="text-xs text-gray-400">CO2 Avoided</div>
              <div className="text-lg font-bold text-emerald-400">{stats.totalCO2.toFixed(0)} t/yr</div>
            </Card>
          </div>

          <Separator className="my-4 bg-gray-800 flex-shrink-0" />

          {/* Building List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <h3 className="text-sm font-semibold text-white mb-3 flex-shrink-0">
              Buildings ({currentTierBuildings.length})
            </h3>
            <ScrollArea className="flex-1 overflow-hidden">
              <div className="space-y-2 pr-4">
                {currentTierBuildings.map((building) => (
                  <div
                    key={building.id}
                    onClick={() => handleBuildingClick(building)}
                    className={`p-3 rounded-lg cursor-pointer transition-all border ${
                      selectedBuilding?.id === building.id
                        ? "bg-blue-900/40 border-blue-600"
                        : "bg-gray-800 border-gray-700 hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {building.type === "school" ? (
                          <School className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Building2 className="w-4 h-4 text-purple-400" />
                        )}
                        <div>
                          <div className="font-semibold text-white text-sm">{building.name}</div>
                          <div className="text-xs text-gray-500">{building.neighborhood}</div>
                        </div>
                      </div>
                      <Badge className={`text-xs font-bold ${getScoreBadgeColor(building.score)}`}>
                        {building.score}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-gray-400">
                        <span className="text-gray-500">Capacity:</span>{" "}
                        <span className="text-blue-300">{building.capacityKwp.toFixed(0)} kWp</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500">Savings:</span>{" "}
                        <span className="text-green-300">R${(building.annualSavingsBrl / 1000).toFixed(0)}k/yr</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Building Detail Card */}
          {selectedBuilding && (
            <>
              <Separator className="my-4 bg-gray-800 flex-shrink-0" />
              <Card className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 flex-shrink-0">
                <h4 className="font-semibold text-white mb-3">{selectedBuilding.name}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Score</span>
                    <Badge className={getScoreBadgeColor(selectedBuilding.score)}>
                      {selectedBuilding.score}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Roof Area</span>
                    <span className="text-white font-medium">{selectedBuilding.roofAreaM2.toFixed(0)} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Capacity</span>
                    <span className="text-blue-300 font-medium">{selectedBuilding.capacityKwp.toFixed(0)} kWp</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Annual Generation</span>
                    <span className="text-green-300 font-medium">{selectedBuilding.annualGenerationMwh.toFixed(1)} MWh</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Annual Savings</span>
                    <span className="text-green-300 font-medium">R${(selectedBuilding.annualSavingsBrl / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Payback Period</span>
                    <span className="text-white font-medium">{selectedBuilding.paybackYears.toFixed(1)} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">CO2 Avoided</span>
                    <span className="text-emerald-300 font-medium">{selectedBuilding.co2AvoidedTonsPerYear.toFixed(0)} t/yr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Solar GHI</span>
                    <span className="text-white font-medium">{selectedBuilding.solarGhi.toFixed(0)} kWh/m²/yr</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Flood Risk</span>
                    <Badge className={getFloodRiskColor(selectedBuilding.floodRisk)}>
                      {selectedBuilding.floodRisk.charAt(0).toUpperCase() + selectedBuilding.floodRisk.slice(1)}
                    </Badge>
                  </div>
                </div>
              </Card>
            </>
          )}

          <TabsContent value={selectedTab} className="mt-0 flex-shrink-0">
            <Button
              onClick={handleSelectScope}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-6"
            >
              Select this scope
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

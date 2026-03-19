import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Neighborhood, CommercialBuilding, ResidentialBuilding, REFERENCE_PROJECTS } from "@/data/intervention-data";
import { ArrowRight, Download, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import L from "leaflet";

interface SolarRegulationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  neighborhoods: Neighborhood[];
  commercialBuildings: CommercialBuilding[];
  residentialBuildings: ResidentialBuilding[];
  map: L.Map | null;
  onNeighborhoodSelect?: (neighborhood: Neighborhood | null) => void;
}

type InstrumentTab = "iptu" | "certification" | "building-code" | null;

export default function SolarRegulationPanel({
  open,
  onOpenChange,
  neighborhoods,
  commercialBuildings,
  residentialBuildings,
  map,
  onNeighborhoodSelect,
}: SolarRegulationPanelProps) {
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentTab>(null);
  const [selectedIPTUTab, setSelectedIPTUTab] = useState<"geospatial" | "projects" | "next-steps">("geospatial");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Neighborhood | null>(null);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "high":
        return "bg-green-900/30 text-green-300 border-green-600";
      case "medium":
        return "bg-yellow-900/30 text-yellow-300 border-yellow-600";
      case "low":
        return "bg-gray-700/50 text-gray-300 border-gray-600";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  const handleNeighborhoodSelect = (neighborhood: Neighborhood) => {
    setSelectedNeighborhood(neighborhood);
    onNeighborhoodSelect?.(neighborhood);
    if (map) {
      const bounds = neighborhood.bounds;
      const latlngs = bounds.map((coord) => [coord[0], coord[1]] as [number, number]);
      const leafletBounds = L.latLngBounds(latlngs);
      map.fitBounds(leafletBounds, { padding: [50, 50] });
    }
  };

  const handleDownloadNeighborhoodList = () => {
    if (!selectedNeighborhood) return;

    const csv = [
      "Neighborhood,Tier,Commercial Buildings,Solar Potential (kWp)",
      `${selectedNeighborhood.name},${selectedNeighborhood.tier},${selectedNeighborhood.commercialBuildings},${selectedNeighborhood.solarPotentialKwp.toFixed(0)}`,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedNeighborhood.name.replace(/\s+/g, "_")}_neighborhoods.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[650px] bg-gray-900 border-l border-gray-800 p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-800">
          <SheetTitle className="text-white">Building Solar Regulation</SheetTitle>
          <p className="text-gray-400 text-sm mt-1">Design IPTU Sustentável incentive for commercial buildings</p>
        </SheetHeader>

        {/* Instrument Selection - Landing Page */}
        {selectedInstrument === null && (
          <div className="flex-1 px-6 py-6 overflow-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Select Policy Instrument</h3>
            <div className="space-y-3">
              {/* IPTU Sustentável */}
              <button
                onClick={() => setSelectedInstrument("iptu")}
                className="w-full p-4 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 hover:border-green-600 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-white">IPTU Sustentável</h4>
                    <p className="text-gray-400 text-sm">Property tax discount for commercial solar PV</p>
                  </div>
                  <Badge className="bg-green-900 text-green-300">Active</Badge>
                </div>
              </button>

              {/* Building Certification */}
              <button
                disabled
                className="w-full p-4 rounded-lg border border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed text-left"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-400">Building Certification</h4>
                    <p className="text-gray-500 text-sm">Sustainability certification requirements</p>
                  </div>
                  <Badge className="bg-gray-700 text-gray-400">Coming soon</Badge>
                </div>
              </button>

              {/* Building Code */}
              <button
                disabled
                className="w-full p-4 rounded-lg border border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed text-left"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-400">Building Code</h4>
                    <p className="text-gray-500 text-sm">Mandatory solar in new construction</p>
                  </div>
                  <Badge className="bg-gray-700 text-gray-400">Coming soon</Badge>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* IPTU Sustentável Content */}
        {selectedInstrument === "iptu" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 pb-2">
              <button
                onClick={() => {
                  setSelectedInstrument(null);
                  setSelectedNeighborhood(null);
                }}
                className="text-sm text-gray-400 hover:text-gray-300 mb-4"
              >
                ← Back to instruments
              </button>
            </div>

            <Tabs
              value={selectedIPTUTab}
              onValueChange={(value) =>
                setSelectedIPTUTab(value as "geospatial" | "projects" | "next-steps")
              }
              className="flex-1 flex flex-col px-6 overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-3 mb-4 bg-gray-800 p-1 flex-shrink-0">
                <TabsTrigger value="geospatial" className="text-xs">
                  Geospatial
                </TabsTrigger>
                <TabsTrigger value="projects" className="text-xs">
                  Projects
                </TabsTrigger>
                <TabsTrigger value="next-steps" className="text-xs">
                  Next Steps
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Geospatial Assessment */}
              <TabsContent value="geospatial" className="flex-1 flex flex-col overflow-hidden mt-0">
                <h3 className="text-sm font-semibold text-white mb-3 flex-shrink-0">Neighborhood Assessment</h3>
                <ScrollArea className="flex-1 overflow-hidden">
                  <div className="space-y-2 pr-4 h-full">
                    {neighborhoods.map((neighborhood) => (
                      <div
                        key={neighborhood.id}
                        onClick={() => handleNeighborhoodSelect(neighborhood)}
                        className={`p-3 rounded-lg cursor-pointer transition-all border ${
                          selectedNeighborhood?.id === neighborhood.id
                            ? "bg-green-900/40 border-green-600"
                            : "bg-gray-800 border-gray-700 hover:bg-gray-700"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-white text-sm">{neighborhood.name}</div>
                            <div className="text-xs text-gray-500">
                              {neighborhood.commercialBuildings} commercial buildings
                            </div>
                          </div>
                          <Badge className={getTierColor(neighborhood.tier)}>
                            {neighborhood.tier === "high"
                              ? "High"
                              : neighborhood.tier === "medium"
                              ? "Medium"
                              : "Low"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="text-gray-400">
                            <span className="text-gray-500">Solar Potential:</span>{" "}
                            <span className="text-blue-300">{neighborhood.solarPotentialKwp.toFixed(0)} kWp</span>
                          </div>
                          <div className="text-gray-400">
                            <span className="text-gray-500">IPTU Revenue:</span>{" "}
                            <span className="text-amber-300">R${(neighborhood.iptuRevenueBrl / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Neighborhood Detail */}
                {selectedNeighborhood && (
                  <>
                    <Separator className="my-4 bg-gray-800" />
                    <div className="space-y-4">
                      <Card className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-semibold text-white">{selectedNeighborhood.name}</h4>
                          <Badge className={getTierColor(selectedNeighborhood.tier)}>
                            {selectedNeighborhood.tier.charAt(0).toUpperCase() +
                              selectedNeighborhood.tier.slice(1)}{" "}
                            Potential
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Commercial Buildings</span>
                            <span className="text-white font-medium">{selectedNeighborhood.commercialBuildings}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Solar Potential</span>
                            <span className="text-blue-300 font-medium">{selectedNeighborhood.solarPotentialKwp.toFixed(0)} kWp</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Annual IPTU Revenue</span>
                            <span className="text-amber-300 font-medium">
                              R${(selectedNeighborhood.iptuRevenueBrl / 1000).toFixed(0)}k
                            </span>
                          </div>
                        </div>
                      </Card>

                      {/* Scenarios */}
                      <div className="grid grid-cols-1 gap-3">
                        {/* Scenario A */}
                        <Card className="p-4 bg-blue-900/20 border-blue-700">
                          <h5 className="font-semibold text-blue-300 mb-3">Scenario A — 5% IPTU Discount</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-300">Revenue Lost/Year</span>
                              <span className="text-blue-300 font-medium">
                                R${(selectedNeighborhood.scenario5pct.revenueLostBrl / 1000).toFixed(0)}k
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-300">PV Installed</span>
                              <span className="text-blue-300 font-medium">
                                {selectedNeighborhood.scenario5pct.pvInstalledKwp.toFixed(0)} kWp
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-300">Annual Generation</span>
                              <span className="text-green-300 font-medium">
                                {selectedNeighborhood.scenario5pct.annualGenerationMwh.toFixed(1)} MWh/yr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-300">CO2 Avoided</span>
                              <span className="text-emerald-300 font-medium">
                                {selectedNeighborhood.scenario5pct.co2AvoidedTons.toFixed(0)} tCO2e/yr
                              </span>
                            </div>
                          </div>
                        </Card>

                        {/* Scenario B */}
                        <Card className="p-4 bg-green-900/20 border-green-700">
                          <h5 className="font-semibold text-green-300 mb-3">Scenario B — 10% IPTU Discount</h5>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-300">Revenue Lost/Year</span>
                              <span className="text-green-300 font-medium">
                                R${(selectedNeighborhood.scenario10pct.revenueLostBrl / 1000).toFixed(0)}k
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-300">PV Installed</span>
                              <span className="text-green-300 font-medium">
                                {selectedNeighborhood.scenario10pct.pvInstalledKwp.toFixed(0)} kWp
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-300">Annual Generation</span>
                              <span className="text-green-300 font-medium">
                                {selectedNeighborhood.scenario10pct.annualGenerationMwh.toFixed(1)} MWh/yr
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-300">CO2 Avoided</span>
                              <span className="text-emerald-300 font-medium">
                                {selectedNeighborhood.scenario10pct.co2AvoidedTons.toFixed(0)} tCO2e/yr
                              </span>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Tab 2: Similar Projects */}
              <TabsContent value="projects" className="flex-1 flex flex-col overflow-hidden mt-0">
                <h3 className="text-sm font-semibold text-white mb-3 flex-shrink-0">Reference Projects</h3>
                <ScrollArea className="flex-1 overflow-hidden">
                  <div className="space-y-3 pr-4">
                    {REFERENCE_PROJECTS.map((project) => (
                      <Card key={project.id} className="p-4 bg-gray-800 border-gray-700">
                        <div className="mb-2">
                          <h4 className="font-semibold text-white text-sm">{project.city}</h4>
                          <p className="text-gray-400 text-xs font-medium">{project.program}</p>
                        </div>
                        <p className="text-gray-300 text-xs leading-relaxed mb-3">{project.summary}</p>
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center gap-1"
                        >
                          Learn more <ExternalLink className="w-3 h-3" />
                        </a>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 3: Next Steps */}
              <TabsContent value="next-steps" className="flex-1 flex flex-col overflow-hidden mt-0">
                <ScrollArea className="flex-1 overflow-hidden">
                  <div className="space-y-4 pr-4">
                    {/* Primary Action */}
                    <Card className="p-4 bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-700">
                      <div className="flex gap-3 mb-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-300 mb-1">
                            Grid Capacity Assessment Required
                          </h4>
                          <p className="text-amber-100 text-sm leading-relaxed mb-3">
                            Before implementing the IPTU Sustentável incentive, the selected high-potential
                            neighborhoods need grid capacity validation. The local distribution grid may have feeder
                            or transformer limitations that constrain how much distributed solar can be interconnected.
                          </p>
                          <p className="text-amber-100 text-sm font-medium mb-3">
                            <strong>Suggested approach:</strong> Request a joint technical assessment with CEEE
                            Equatorial (the local energy distributor) to evaluate:
                          </p>
                          <ul className="text-amber-100 text-sm space-y-1 ml-4 mb-3">
                            <li>• Feeder capacity and current loading</li>
                            <li>• Transformer headroom for reverse power flow</li>
                            <li>• Interconnection requirements and timelines for each priority neighborhood</li>
                          </ul>
                          <Button
                            onClick={handleDownloadNeighborhoodList}
                            disabled={!selectedNeighborhood}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-sm w-full"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download neighborhood list for distributor
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* Other pending data */}
                    <Card className="p-4 bg-gray-800 border-gray-700">
                      <h4 className="font-semibold text-white mb-3">Other Pending Data to Collect</h4>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex gap-2">
                          <CheckCircle2 className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                          <span>Updated commercial building registry with roof area measurements</span>
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                          <span>Current IPTU billing records by neighborhood</span>
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                          <span>Historical solar permit data (existing PV installations)</span>
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                          <span>Heritage/preservation zone boundaries</span>
                        </li>
                        <li className="flex gap-2">
                          <CheckCircle2 className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                          <span>Flood risk overlay for PV investment viability</span>
                        </li>
                      </ul>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

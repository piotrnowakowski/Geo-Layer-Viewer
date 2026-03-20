import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Download,
  MapPinned,
  Receipt,
  Sun,
  Zap,
} from "lucide-react";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { loadBoundaryData } from "@/data/sample-data-loaders";
import { SOLAR_REGULATION_PROJECT_REFERENCES } from "@/data/solar-regulation-projects";
import {
  buildSolarRegulationCsv,
  loadSolarRegulationData,
  type SolarRegulationDataset,
  type SolarRegulationNeighbourhood,
  type SolarRegulationTier,
} from "@/data/solar-regulation";

type PolicyInstrument = "iptu" | "certification" | "code";

const TIER_STYLES: Record<
  SolarRegulationTier,
  { fill: string; stroke: string; badge: string; label: string }
> = {
  high: {
    fill: "#22c55e",
    stroke: "#166534",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
    label: "High Potential",
  },
  medium: {
    fill: "#f59e0b",
    stroke: "#b45309",
    badge: "bg-amber-500/20 text-amber-100 border-amber-500/30",
    label: "Medium Potential",
  },
  low: {
    fill: "#71717a",
    stroke: "#3f3f46",
    badge: "bg-zinc-500/20 text-zinc-100 border-zinc-500/30",
    label: "Low Potential",
  },
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatCompactNumber(value: number, digits = 1): string {
  return value.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}%`;
}

function formatRatio(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SolarRegulationPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);

  const [dataset, setDataset] = useState<SolarRegulationDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeInstrument, setActiveInstrument] = useState<PolicyInstrument>("iptu");
  const [selectedNeighbourhoodId, setSelectedNeighbourhoodId] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    const init = async () => {
      const boundaryData = await loadBoundaryData().catch(() => null);
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      const center: [number, number] = boundaryData?.centroid
        ? [boundaryData.centroid[0], boundaryData.centroid[1]]
        : [-30.0346, -51.2177];

      const map = L.map(mapContainerRef.current, {
        center,
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      if (boundaryData?.boundaryGeoJson) {
        L.geoJSON(boundaryData.boundaryGeoJson, {
          style: {
            color: "#e4e4e7",
            weight: 1.5,
            opacity: 0.5,
            fillOpacity: 0,
            dashArray: "6 4",
          },
        }).addTo(map);
      }

      overlayRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      if (boundaryData?.bbox) {
        const [south, west, north, east] = boundaryData.bbox;
        map.fitBounds([
          [south, west],
          [north, east],
        ]);
      }
    };

    init().catch((err: unknown) => {
      console.error("Failed to initialize solar regulation demo map:", err);
    });

    return () => {
      cancelled = true;
      overlayRef.current?.clearLayers();
      mapRef.current?.remove();
      overlayRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        const nextDataset = await loadSolarRegulationData();
        if (cancelled) return;
        setDataset(nextDataset);
        setSelectedNeighbourhoodId(nextDataset.neighbourhoods[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Failed to load solar regulation demo data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedNeighbourhood = useMemo(
    () =>
      dataset?.neighbourhoods.find(
        (neighbourhood) => neighbourhood.id === selectedNeighbourhoodId
      ) ?? null,
    [dataset, selectedNeighbourhoodId]
  );

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay || !dataset) return;

    overlay.clearLayers();

    dataset.neighbourhoods.forEach((neighbourhood) => {
      const isSelected = neighbourhood.id === selectedNeighbourhoodId;
      const style = TIER_STYLES[neighbourhood.tier];

      const layer = L.geoJSON(
        {
          type: "Feature",
          properties: {
            id: neighbourhood.id,
            name: neighbourhood.name,
          },
          geometry: neighbourhood.geometry,
        } as GeoJSON.Feature,
        {
          style: {
            color: isSelected ? "#fafafa" : style.stroke,
            fillColor: style.fill,
            fillOpacity: isSelected ? 0.72 : 0.46,
            weight: isSelected ? 2.6 : 1.5,
            opacity: 0.95,
          },
          onEachFeature: (_feature, layerItem) => {
            layerItem.on("click", () => {
              setSelectedNeighbourhoodId(neighbourhood.id);
              const bounds = (layerItem as any).getBounds?.();
              if (bounds?.isValid()) {
                map.fitBounds(bounds.pad(0.2));
              }
            });
            layerItem.bindTooltip(
              `<div style="font-family: system-ui; font-size: 11px;">
                <strong>${neighbourhood.name}</strong><br/>
                ${TIER_STYLES[neighbourhood.tier].label}<br/>
                Solar potential: ${neighbourhood.solarPotentialKwp.toLocaleString()} kWp<br/>
                Commercial IPTU: ${formatCurrency(neighbourhood.iptuRevenueBrl)}
              </div>`,
              { sticky: true }
            );
          },
        }
      );

      layer.addTo(overlay);
    });

    dataset.buildings.forEach((building) => {
      const neighbourhood = dataset.neighbourhoods.find(
        (item) => item.number === building.neighbourhoodNumber
      );
      if (!neighbourhood) return;

      const tierStyle = TIER_STYLES[neighbourhood.tier];
      const marker = L.circleMarker([building.lat, building.lng], {
        radius: 4.5,
        fillColor: tierStyle.fill,
        color: "#fafafa",
        weight: 1,
        fillOpacity: 0.85,
        opacity: 0.95,
      });

      marker.on("click", () => {
        setSelectedNeighbourhoodId(neighbourhood.id);
      });

      marker.bindTooltip(
        `<div style="font-family: system-ui; font-size: 11px;">
          <strong>Commercial building #${building.id}</strong><br/>
          ${building.neighbourhoodName}<br/>
          ${
            building.solarPotentialKwp !== null
              ? `Potential: ${building.solarPotentialKwp.toLocaleString()} kWp<br/>`
              : ""
          }
          ${
            building.annualGenerationMwh !== null
              ? `Generation: ${building.annualGenerationMwh.toLocaleString()} MWh/year`
              : ""
          }
        </div>`,
        { sticky: true }
      );

      marker.addTo(overlay);
    });
  }, [dataset, selectedNeighbourhoodId]);

  const summary = useMemo(() => {
    if (!dataset) return null;
    const solarPotentialKwp = dataset.neighbourhoods.reduce(
      (sum, item) => sum + item.solarPotentialKwp,
      0
    );
    const annualGenerationMwh = dataset.neighbourhoods.reduce(
      (sum, item) => sum + item.annualGenerationMwh,
      0
    );
    const iptuRevenueBrl = dataset.neighbourhoods.reduce(
      (sum, item) => sum + item.iptuRevenueBrl,
      0
    );
    const estimatedInvestmentBrl = dataset.neighbourhoods.reduce(
      (sum, item) => sum + item.estimatedInvestmentBrl,
      0
    );
    const buildings = dataset.neighbourhoods.reduce(
      (sum, item) => sum + item.commercialBuildings,
      0
    );

    return {
      solarPotentialKwp,
      annualGenerationMwh,
      iptuRevenueBrl,
      estimatedInvestmentBrl,
      buildings,
    };
  }, [dataset]);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-50">
      <Header />

      <div className="flex-1 min-h-0 flex">
        <div className="relative flex-1 min-w-0">
          <div ref={mapContainerRef} className="absolute inset-0" />

          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-3 max-w-sm">
            <Link href="/">
              <a className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-sm text-zinc-100 backdrop-blur hover:bg-zinc-800/95">
                <ArrowLeft className="h-4 w-4" />
                Back To Main Map
              </a>
            </Link>

              <Card className="border-white/10 bg-zinc-900/95 text-zinc-50 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Coverage</CardTitle>
                  <CardDescription className="text-zinc-300">
                    Standalone regulation demo using the currently processed commercial
                  neighbourhood subset.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-zinc-200">
                  <div>
                    Showing the currently processed neighbourhood subset used for this
                    standalone solar regulation demo.
                  </div>
                  <div className="text-zinc-400">
                    Current solar subset: Anchieta, Arquipélago, Auxiliadora, Sarandi.
                  </div>
                </CardContent>
              </Card>

            <Card className="border-white/10 bg-zinc-900/95 text-zinc-50 backdrop-blur">
              <CardContent className="flex items-center gap-4 p-4 text-sm">
                {(["high", "medium", "low"] as SolarRegulationTier[]).map((tier) => (
                  <div key={tier} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: TIER_STYLES[tier].fill }}
                    />
                    <span>{TIER_STYLES[tier].label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="w-[624px] max-w-[66vw] min-w-[480px] border-l border-white/10 bg-zinc-950/95 backdrop-blur">
          <ScrollArea className="h-full">
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-semibold">Building Solar Regulation</h1>
                    <p className="text-sm text-zinc-400">
                      Standalone IPTU Sustentável demo. Existing app flows are untouched.
                    </p>
                  </div>
                  <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-100">
                    Standalone
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  className="w-full justify-start bg-[#001fa8] hover:bg-[#1732bf]"
                  onClick={() => setActiveInstrument("iptu")}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  IPTU Sustentável
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start border-white/10 bg-zinc-900 text-zinc-500"
                  disabled
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Building Certification
                  <Badge className="ml-auto border-white/10 bg-zinc-800 text-zinc-400">
                    Coming Soon
                  </Badge>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start border-white/10 bg-zinc-900 text-zinc-500"
                  disabled
                >
                  <MapPinned className="mr-2 h-4 w-4" />
                  Building Code
                  <Badge className="ml-auto border-white/10 bg-zinc-800 text-zinc-400">
                    Coming Soon
                  </Badge>
                </Button>
              </div>

              {activeInstrument === "iptu" && (
                <Tabs defaultValue="assessment" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
                    <TabsTrigger value="assessment">Assessment</TabsTrigger>
                    <TabsTrigger value="projects">Projects</TabsTrigger>
                    <TabsTrigger value="next">Next Steps</TabsTrigger>
                  </TabsList>

                  <TabsContent value="assessment" className="space-y-4 pt-4">
                    {loading && (
                      <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                        <CardContent className="p-4 text-sm text-zinc-300">
                          Loading standalone solar regulation data...
                        </CardContent>
                      </Card>
                    )}

                    {error && (
                      <Card className="border-red-500/30 bg-red-500/10 text-red-100">
                        <CardContent className="p-4 text-sm">{error}</CardContent>
                      </Card>
                    )}

                    {summary && (
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                          <CardContent className="p-4">
                            <div className="text-xs uppercase tracking-wide text-zinc-500">
                              Covered Buildings
                            </div>
                            <div className="mt-2 text-xl font-semibold">
                              {summary.buildings.toLocaleString()}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                          <CardContent className="p-4">
                            <div className="text-xs uppercase tracking-wide text-zinc-500">
                              Solar Potential
                            </div>
                            <div className="mt-2 text-xl font-semibold">
                              {formatCompactNumber(summary.solarPotentialKwp)} kWp
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                          <CardContent className="p-4">
                            <div className="text-xs uppercase tracking-wide text-zinc-500">
                              Annual Generation
                            </div>
                            <div className="mt-2 text-xl font-semibold">
                              {formatCompactNumber(summary.annualGenerationMwh)} MWh
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                          <CardContent className="p-4">
                            <div className="text-xs uppercase tracking-wide text-zinc-500">
                              Commercial IPTU
                            </div>
                            <div className="mt-2 text-xl font-semibold">
                              {formatCompactNumber(summary.iptuRevenueBrl)} BRL
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="col-span-2 border-white/10 bg-zinc-900 text-zinc-100">
                          <CardContent className="p-4">
                            <div className="text-xs uppercase tracking-wide text-zinc-500">
                              Estimated Private Solar Investment Base
                            </div>
                            <div className="mt-2 text-xl font-semibold">
                              {formatCompactNumber(summary.estimatedInvestmentBrl)} BRL
                            </div>
                            <div className="mt-1 text-xs text-zinc-400">
                              Summed from the current building-level installation cost estimates.
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Neighbourhood Ranking</CardTitle>
                        <CardDescription className="text-zinc-400">
                          Score = 50% solar potential + 50% inverse commercial IPTU exposure.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {dataset?.neighbourhoods.map((neighbourhood) => (
                          <button
                            key={neighbourhood.id}
                            type="button"
                            onClick={() => setSelectedNeighbourhoodId(neighbourhood.id)}
                            className={`w-full rounded-xl border p-3 text-left transition-colors ${
                              selectedNeighbourhoodId === neighbourhood.id
                                ? "border-white/30 bg-zinc-800"
                                : "border-white/10 bg-zinc-950 hover:bg-zinc-800/70"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{neighbourhood.name}</div>
                                <div className="mt-1 text-xs text-zinc-400">
                                  {neighbourhood.commercialBuildings.toLocaleString()} commercial
                                  buildings
                                </div>
                              </div>
                              <Badge className={TIER_STYLES[neighbourhood.tier].badge}>
                                {TIER_STYLES[neighbourhood.tier].label}
                              </Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <div className="text-zinc-500">Potential</div>
                                <div>{neighbourhood.solarPotentialKwp.toLocaleString()} kWp</div>
                              </div>
                              <div>
                                <div className="text-zinc-500">Commercial IPTU</div>
                                <div>{formatCurrency(neighbourhood.iptuRevenueBrl)}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </CardContent>
                    </Card>

                    {selectedNeighbourhood && (
                      <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <CardTitle className="text-lg">
                                {selectedNeighbourhood.name}
                              </CardTitle>
                              <CardDescription className="text-zinc-400">
                                Commercial solar vs IPTU trade-off
                              </CardDescription>
                            </div>
                            <Badge className={TIER_STYLES[selectedNeighbourhood.tier].badge}>
                              {TIER_STYLES[selectedNeighbourhood.tier].label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-lg border border-white/10 bg-zinc-950 p-3">
                              <div className="text-zinc-500">Commercial Buildings</div>
                              <div className="mt-1 font-medium">
                                {selectedNeighbourhood.commercialBuildings.toLocaleString()}
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-zinc-950 p-3">
                              <div className="text-zinc-500">Score</div>
                              <div className="mt-1 font-medium">
                                {selectedNeighbourhood.score.toFixed(1)}
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-zinc-950 p-3">
                              <div className="text-zinc-500">Solar Potential</div>
                              <div className="mt-1 font-medium">
                                {selectedNeighbourhood.solarPotentialKwp.toLocaleString()} kWp
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-zinc-950 p-3">
                              <div className="text-zinc-500">Commercial IPTU</div>
                              <div className="mt-1 font-medium">
                                {formatCurrency(selectedNeighbourhood.iptuRevenueBrl)}
                              </div>
                            </div>
                            <div className="col-span-2 rounded-lg border border-white/10 bg-zinc-950 p-3">
                              <div className="text-zinc-500">
                                Estimated Private Solar Investment Base
                              </div>
                              <div className="mt-1 font-medium">
                                {formatCurrency(selectedNeighbourhood.estimatedInvestmentBrl)}
                              </div>
                              <div className="mt-1 text-xs text-zinc-400">
                                Building-level installation cost estimates available for the current
                                neighbourhood subset.
                              </div>
                            </div>
                          </div>

                          <Separator className="bg-white/10" />

                          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-zinc-200">
                            <div className="font-medium text-zinc-50">
                              Calculation assumptions
                            </div>
                            <div className="mt-3 grid gap-2 text-zinc-300 md:grid-cols-3">
                              <div>
                                Tax line = current commercial IPTU total x discount rate.
                              </div>
                              <div>
                                Private investment line = building installation-cost baseline x
                                assumed uptake.
                              </div>
                              <div>
                                Solar, generation, and CO2 lines = neighbourhood rooftop-solar
                                baseline x assumed uptake.
                              </div>
                            </div>
                            <div className="mt-3 text-xs leading-relaxed text-zinc-400">
                              Scenario A uses a {formatPercent(selectedNeighbourhood.scenario5.discountRate)}{" "}
                              discount and assumes {formatPercent(selectedNeighbourhood.scenario5.adoptionRate)}{" "}
                              uptake. Scenario B uses a{" "}
                              {formatPercent(selectedNeighbourhood.scenario10.discountRate)} discount
                              and assumes {formatPercent(selectedNeighbourhood.scenario10.adoptionRate)}{" "}
                              uptake. The tax loss is shown against the full commercial IPTU base,
                              with private investment scaled from the current installation-cost
                              estimates and no behavioural response or eligibility filter modeled.
                            </div>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-2">
                            <Card className="border-white/10 bg-zinc-950 text-zinc-100">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Scenario A</CardTitle>
                                <CardDescription className="text-zinc-400">
                                  5% IPTU discount
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm">
                                <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                                  <div>
                                    Discount applied:{" "}
                                    {formatPercent(selectedNeighbourhood.scenario5.discountRate)} of
                                    current commercial IPTU
                                  </div>
                                  <div className="mt-1">
                                    Assumed uptake:{" "}
                                    {formatPercent(selectedNeighbourhood.scenario5.adoptionRate)} of
                                    the rooftop-solar baseline
                                  </div>
                                </div>
                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-zinc-300">Revenue lost</span>
                                    <span className="font-medium">
                                      {formatCurrency(selectedNeighbourhood.scenario5.revenueLostBrl)}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <span className="text-zinc-300">Private investment mobilized</span>
                                    <span className="font-medium text-emerald-200">
                                      {formatCurrency(
                                        selectedNeighbourhood.scenario5.privateInvestmentBrl
                                      )}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-zinc-400">
                                    {selectedNeighbourhood.scenario5.revenueLostBrl > 0
                                      ? `~BRL ${formatRatio(
                                          selectedNeighbourhood.scenario5.privateInvestmentBrl /
                                            selectedNeighbourhood.scenario5.revenueLostBrl
                                        )} of private solar capex per BRL 1 of IPTU relief`
                                      : "No IPTU relief modeled in this scenario."}
                                  </div>
                                </div>
                                <div>PV installed: {selectedNeighbourhood.scenario5.pvInstalledKwp.toLocaleString()} kWp</div>
                                <div>Generation: {selectedNeighbourhood.scenario5.annualGenerationMwh.toLocaleString()} MWh/year</div>
                                <div>CO2 avoided: {selectedNeighbourhood.scenario5.co2AvoidedTons.toLocaleString()} t/year</div>
                              </CardContent>
                            </Card>

                            <Card className="border-white/10 bg-zinc-950 text-zinc-100">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base">Scenario B</CardTitle>
                                <CardDescription className="text-zinc-400">
                                  10% IPTU discount
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm">
                                <div className="rounded-lg border border-white/10 bg-zinc-900/60 p-3 text-xs text-zinc-300">
                                  <div>
                                    Discount applied:{" "}
                                    {formatPercent(selectedNeighbourhood.scenario10.discountRate)} of
                                    current commercial IPTU
                                  </div>
                                  <div className="mt-1">
                                    Assumed uptake:{" "}
                                    {formatPercent(selectedNeighbourhood.scenario10.adoptionRate)} of
                                    the rooftop-solar baseline
                                  </div>
                                </div>
                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-zinc-300">Revenue lost</span>
                                    <span className="font-medium">
                                      {formatCurrency(selectedNeighbourhood.scenario10.revenueLostBrl)}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <span className="text-zinc-300">Private investment mobilized</span>
                                    <span className="font-medium text-emerald-200">
                                      {formatCurrency(
                                        selectedNeighbourhood.scenario10.privateInvestmentBrl
                                      )}
                                    </span>
                                  </div>
                                  <div className="mt-2 text-xs text-zinc-400">
                                    {selectedNeighbourhood.scenario10.revenueLostBrl > 0
                                      ? `~BRL ${formatRatio(
                                          selectedNeighbourhood.scenario10.privateInvestmentBrl /
                                            selectedNeighbourhood.scenario10.revenueLostBrl
                                        )} of private solar capex per BRL 1 of IPTU relief`
                                      : "No IPTU relief modeled in this scenario."}
                                  </div>
                                </div>
                                <div>PV installed: {selectedNeighbourhood.scenario10.pvInstalledKwp.toLocaleString()} kWp</div>
                                <div>Generation: {selectedNeighbourhood.scenario10.annualGenerationMwh.toLocaleString()} MWh/year</div>
                                <div>CO2 avoided: {selectedNeighbourhood.scenario10.co2AvoidedTons.toLocaleString()} t/year</div>
                              </CardContent>
                            </Card>
                          </div>

                          {selectedNeighbourhood.taxPerCommercialBuilding !== null && (
                            <div className="text-sm text-zinc-400">
                              Tax per commercial building:{" "}
                              {formatCurrency(selectedNeighbourhood.taxPerCommercialBuilding)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="projects" className="space-y-4 pt-4">
                    <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                      <CardHeader>
                        <CardTitle className="text-base">
                          Comparable Projects Outside Porto Alegre
                        </CardTitle>
                        <CardDescription className="text-zinc-400">
                          Official benchmark cases from other cities and countries only.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm text-zinc-300">
                        <p>
                          Each case below is an external precedent selected to show a different
                          policy route: tax relief, building mandates, municipal procurement,
                          shared solar, and export compensation.
                        </p>
                        <p className="text-zinc-400">
                          Where official sources reported delivered results, the output is called
                          out separately so the comparison is based on observed deployment, not
                          generic policy language.
                        </p>
                      </CardContent>
                    </Card>

                    {SOLAR_REGULATION_PROJECT_REFERENCES.map((project) => (
                      <Card
                        key={project.id}
                        className="border-white/10 bg-zinc-900 text-zinc-100"
                      >
                        <CardHeader className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <CardTitle className="text-lg leading-tight">
                                {project.title}
                              </CardTitle>
                              <div className="flex flex-wrap gap-2">
                                <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-100">
                                  {project.category}
                                </Badge>
                                <Badge className="border-white/10 bg-zinc-800 text-zinc-200">
                                  {project.status}
                                </Badge>
                              </div>
                            </div>

                            <div className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-right text-xs text-zinc-400">
                              <div className="uppercase tracking-wide text-zinc-500">
                                Timing
                              </div>
                              <div className="mt-1 text-zinc-200">{project.timing}</div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div className="space-y-2 text-sm text-zinc-300">
                            <p>{project.summary}</p>
                            <p className="text-zinc-400">{project.relevance}</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {project.highlights.map((highlight) => (
                              <span
                                key={highlight}
                                className="rounded-full border border-white/10 bg-zinc-950 px-3 py-1 text-xs text-zinc-300"
                              >
                                {highlight}
                              </span>
                            ))}
                          </div>

                          {project.outputs && project.outputs.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                                Observed Outputs
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {project.outputs.map((output) => (
                                  <span
                                    key={output}
                                    className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100"
                                  >
                                    {output}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {project.links.map((link, index) => (
                              <a
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`link-solar-project-${project.id}-${index}`}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 transition-colors hover:bg-zinc-800"
                              >
                                {link.label}
                                <ArrowUpRight className="h-4 w-4 text-zinc-400" />
                              </a>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="next" className="space-y-4 pt-4">
                    <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Zap className="h-4 w-4 text-blue-300" />
                          Define Grid Capacity For Priority Neighbourhoods
                        </CardTitle>
                        <CardDescription className="text-zinc-400">
                          Validate feeder and transformer headroom before policy launch.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm text-zinc-300">
                        <p>
                          Request a joint technical assessment with CEEE Equatorial covering feeder
                          loading, transformer headroom for reverse flow, and interconnection
                          requirements for the currently covered neighbourhood subset.
                        </p>
                        <Button
                          type="button"
                          className="w-full bg-[#001fa8] hover:bg-[#1732bf]"
                          onClick={() => {
                            if (!dataset) return;
                            downloadTextFile(
                              "solar-regulation-neighbourhoods.csv",
                              buildSolarRegulationCsv(dataset.neighbourhoods)
                            );
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Neighbourhood List
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-zinc-900 text-zinc-100">
                      <CardHeader>
                        <CardTitle className="text-base">Pending Data</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm text-zinc-300">
                          <li>Updated commercial building registry with roof area measurements</li>
                          <li>Current IPTU billing records by neighbourhood for validation</li>
                          <li>Historical solar permit data for existing PV uptake</li>
                          <li>Heritage or preservation overlays affecting rooftop installations</li>
                          <li>Flood-risk overlay for long-term commercial PV viability</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

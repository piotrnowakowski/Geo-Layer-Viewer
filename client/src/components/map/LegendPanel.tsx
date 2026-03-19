import { useState } from "react";
import { ChevronDown, ChevronUp, Info, X } from "lucide-react";
import type { LayerState } from "@/data/layer-configs";
import {
  getMunicipalBuildingsSolarAnnualEnergyKwh,
  getMunicipalBuildingsSolarCapacityKw,
  getMunicipalBuildingsSolarCarbonOffsetKgPerYear,
  getMunicipalBuildingsSolarDisplayName,
  getMunicipalBuildingsSolarInvestmentAmount,
  isMunicipalBuildingsSolarLayerId,
  MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_COLORS,
  MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS,
  MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_TIERS,
  type MunicipalBuildingsSolarPriorityTier,
} from "@/data/municipal-buildings-solar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

interface LegendInfoItem {
  label: string;
  description: string;
}

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

  // ── IBGE & social (real measured values) ────────────────────────────────────
  ibge_census:    { kind: "gradient", colors: ["#ede9fe","#c084fc","#a855f7","#7e22ce","#3b0764"], labels: ["2%", "35% poverty rate"] },
  ibge_settlements: { kind: "solid" },
  "iptu-neighbourhoods": { kind: "gradient", colors: ["#dbeafe","#93c5fd","#3b82f6","#1d4ed8","#1e3a8a"], labels: ["Low", "High IPTU value"] },

  // ── Solar (real PVOUT values from 99 neighbourhoods) ───────────────────────
  solar_potential:  { kind: "gradient", colors: ["#fef3c7","#fde68a","#fbbf24","#f59e0b","#b45309"], labels: ["4.0", "4.1 kWh/kWp/d"] },
  municipal_buildings_solar: { kind: "point" },

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

  // ── Spatial Query layers ─────────────────────────────────────────────────────
  post_settlements_flood: { kind: "solid" },
  post_bus_heatwave: { kind: "line" },
};

const LEGEND_INFO: Record<string, LegendInfoItem[]> = {};

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

function InfoItems({ items }: { items: LegendInfoItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-2 ml-5 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid={`legend-info-${item.label.toLowerCase().replaceAll(/\s+/g, "-")}`}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Info className="h-2.5 w-2.5" />
              <span>{item.label}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-[10px] leading-snug">
            {item.description}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function getLegendDef(layer: LayerState): LegendDef {
  return LEGEND_DEF[layer.id] ?? { kind: "solid" };
}

function getLegendInfoItems(layer: LayerState): LegendInfoItem[] {
  if (isMunicipalBuildingsSolarLayerId(layer.id)) {
    const summary = layer.data?.priorityTierSummary;
    return [
      {
        label: "Tiering",
        description:
          summary?.scoreMethod ??
          "Priority score averages normalized yearly generation and usable roof area, then ranks the portfolio into 20/40/40 tiers.",
      },
      {
        label: "Source",
        description:
          "The layer uses the real municipal Google Building Insights export in client/public/sample-data/porto-alegre-google-solar-municipal-buildings.json, with geocoded source records added back for the two buildings missing solar enrichment.",
      },
      {
        label: "Portfolio",
        description:
          summary
            ? `${summary.enrichedBuildings.toLocaleString()} buildings carry solar metrics and ${summary.geocodedOnlyBuildings.toLocaleString()} remain geocoded-only placeholders. Payback is unavailable in the current export because the source dataset contains no financial analysis entries.`
            : "The municipal solar portfolio combines solar-enriched buildings with geocoded-only placeholders when no solar enrichment is present.",
      },
    ];
  }

  return LEGEND_INFO[layer.id] ?? [];
}

interface MunicipalSolarPanelState {
  data: any;
  visibleTiers: Record<MunicipalBuildingsSolarPriorityTier, boolean>;
  onToggleTier: (tier: MunicipalBuildingsSolarPriorityTier) => void;
  selectedFeature: any | null;
  onClearSelectedFeature: () => void;
}

function formatMetricNumber(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMetricMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function getMunicipalSolarSelectedFeatures(
  data: any,
  visibleTiers: Record<MunicipalBuildingsSolarPriorityTier, boolean>
): any[] {
  const features = data?.geoJson?.features;
  if (!Array.isArray(features)) return [];
  return features.filter((feature: any) => {
    const tier = feature?.properties?.priorityTier;
    return (
      typeof tier === "string" &&
      tier in visibleTiers &&
      visibleTiers[tier as MunicipalBuildingsSolarPriorityTier]
    );
  });
}

function summarizeMunicipalSolarMetrics(features: any[]) {
  let capacityKw = 0;
  let capacityCount = 0;
  let investmentBrl = 0;
  let investmentCount = 0;
  let carbonKg = 0;
  let carbonCount = 0;

  for (const feature of features) {
    const properties = feature?.properties || {};
    const capacityValue = getMunicipalBuildingsSolarCapacityKw(properties);
    if (capacityValue !== null) {
      capacityKw += capacityValue;
      capacityCount += 1;
    }

    const investmentValue = getMunicipalBuildingsSolarInvestmentAmount(properties);
    if (investmentValue !== null) {
      investmentBrl += investmentValue;
      investmentCount += 1;
    }

    const carbonValue = getMunicipalBuildingsSolarCarbonOffsetKgPerYear(properties);
    if (carbonValue !== null) {
      carbonKg += carbonValue;
      carbonCount += 1;
    }
  }

  return {
    selectedCount: features.length,
    capacityKw: capacityCount > 0 ? capacityKw : null,
    capacityCount,
    investmentBrl: investmentCount > 0 ? investmentBrl : null,
    investmentCount,
    carbonKg: carbonCount > 0 ? carbonKg : null,
    carbonCount,
  };
}

function SummaryCard({
  label,
  value,
  subtext,
  accentColor,
}: {
  label: string;
  value: string;
  subtext: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5">
      <div className="flex items-center gap-1.5">
        <div
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-100 leading-tight">{value}</div>
      <div className="mt-1 text-[9px] leading-snug text-zinc-500">{subtext}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className="text-[10px] text-right text-zinc-200 leading-snug">{value}</span>
    </div>
  );
}

function MunicipalSolarPanel({
  panel,
}: {
  panel: MunicipalSolarPanelState;
}) {
  const summary = panel.data?.priorityTierSummary;
  const selectedFeatures = getMunicipalSolarSelectedFeatures(panel.data, panel.visibleTiers);
  const metrics = summarizeMunicipalSolarMetrics(selectedFeatures);
  const totalBuildings =
    typeof summary?.totalBuildings === "number" ? summary.totalBuildings : selectedFeatures.length;
  const selectedProperties = panel.selectedFeature?.properties || null;
  const selectedTier =
    selectedProperties?.priorityTier as MunicipalBuildingsSolarPriorityTier | undefined;
  const selectedTierColor = selectedTier
    ? MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_COLORS[selectedTier]
    : "#f59e0b";
  const selectedName = selectedProperties
    ? getMunicipalBuildingsSolarDisplayName(selectedProperties)
    : null;
  const selectedCapacity = selectedProperties
    ? getMunicipalBuildingsSolarCapacityKw(selectedProperties)
    : null;
  const selectedPayback =
    selectedProperties && typeof selectedProperties.paybackYears === "number"
      ? `${formatMetricNumber(selectedProperties.paybackYears, 1)} years`
      : "Unavailable";
  const selectedEnergy = selectedProperties
    ? getMunicipalBuildingsSolarAnnualEnergyKwh(selectedProperties)
    : null;
  const selectedInvestment = selectedProperties
    ? getMunicipalBuildingsSolarInvestmentAmount(selectedProperties)
    : null;
  const selectedCarbon = selectedProperties
    ? getMunicipalBuildingsSolarCarbonOffsetKgPerYear(selectedProperties)
    : null;

  return (
    <div className="mt-3 border-t border-zinc-800/70 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-wide text-zinc-200">
            Municipal Building Solar
          </div>
          <div className="mt-1 text-[9px] leading-snug text-zinc-500">
            {metrics.selectedCount.toLocaleString()} of {totalBuildings.toLocaleString()} buildings
            visible across the selected tiers.
          </div>
        </div>
        <div className="text-[9px] text-right text-zinc-500 max-w-[156px]">
          Priority score = normalized yearly generation + roof area.
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_TIERS.map((tier) => {
          const bucket = summary?.[tier];
          const enabled = panel.visibleTiers[tier];
          return (
            <button
              key={tier}
              type="button"
              data-testid={`button-municipal-solar-tier-${tier}`}
              onClick={() => panel.onToggleTier(tier)}
              className="rounded-lg border px-2 py-2 text-left transition-colors"
              style={{
                borderColor: enabled
                  ? `${MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_COLORS[tier]}88`
                  : "rgba(63,63,70,0.9)",
                backgroundColor: enabled
                  ? `${MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_COLORS[tier]}16`
                  : "rgba(24,24,27,0.7)",
              }}
            >
              <div className="text-[10px] font-medium text-zinc-100">
                {MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS[tier]}
              </div>
              <div className="mt-1 text-[9px] text-zinc-500">
                {typeof bucket?.count === "number"
                  ? `${bucket.count.toLocaleString()} buildings`
                  : "No data"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SummaryCard
          label="Total Capacity"
          value={
            metrics.capacityKw !== null
              ? `${formatMetricNumber(metrics.capacityKw, 1)} kW`
              : "Unavailable"
          }
          subtext={
            metrics.capacityCount > 0
              ? `${metrics.capacityCount.toLocaleString()} buildings with rooftop sizing`
              : "No capacity values in the selected set"
          }
          accentColor="#f59e0b"
        />
        <SummaryCard
          label="Investment"
          value={formatMetricMoney(metrics.investmentBrl)}
          subtext={
            metrics.investmentCount > 0
              ? `${metrics.investmentCount.toLocaleString()} buildings with cost estimates`
              : "No investment estimates in the selected set"
          }
          accentColor="#38bdf8"
        />
        <SummaryCard
          label="CO2"
          value={
            metrics.carbonKg !== null
              ? `${formatMetricNumber(metrics.carbonKg, 0)} kg/yr`
              : "Unavailable"
          }
          subtext={
            metrics.carbonCount > 0
              ? `${metrics.carbonCount.toLocaleString()} buildings with annual carbon offset`
              : "No carbon values in the selected set"
          }
          accentColor="#ef4444"
        />
      </div>

      <div className="mt-2 text-[9px] leading-snug text-zinc-500">
        Payback stays unavailable because the current municipal Google Building Insights
        export contains no financial analysis entries.
      </div>

      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              Building Detail
            </div>
            <div className="mt-1 text-[11px] font-semibold leading-snug text-zinc-100">
              {selectedName ?? "Click a building on the map"}
            </div>
            {selectedProperties && (
              <div className="mt-1 text-[9px] text-zinc-500">
                {(selectedProperties.utilizedBy || "Municipal building") +
                  (selectedTier ? ` · ${MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS[selectedTier]}` : "")}
              </div>
            )}
          </div>
          {selectedProperties && (
            <button
              type="button"
              data-testid="button-municipal-solar-clear-selection"
              onClick={panel.onClearSelectedFeature}
              className="rounded-md border border-zinc-800 p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {selectedProperties ? (
          <div className="mt-3 space-y-2">
            <DetailRow
              label="Score"
              value={
                typeof selectedProperties.priorityScore === "number"
                  ? formatMetricNumber(selectedProperties.priorityScore, 1)
                  : "Unavailable"
              }
            />
            <DetailRow
              label="Capacity"
              value={
                selectedCapacity !== null
                  ? `${formatMetricNumber(selectedCapacity, 1)} kW DC`
                  : "Unavailable"
              }
            />
            <DetailRow
              label="Generation"
              value={
                selectedEnergy !== null
                  ? `${formatMetricNumber(selectedEnergy, 0)} kWh/year`
                  : "Unavailable"
              }
            />
            <DetailRow label="Investment" value={formatMetricMoney(selectedInvestment)} />
            <DetailRow
              label="CO2"
              value={
                selectedCarbon !== null
                  ? `${formatMetricNumber(selectedCarbon, 0)} kg CO2e/year`
                  : "Unavailable"
              }
            />
            <DetailRow label="Payback" value={selectedPayback} />
            {selectedProperties.importStatus === "seed_only" && (
              <div
                className="rounded-md border border-zinc-800 px-2 py-1.5 text-[9px] leading-snug text-zinc-500"
                style={{ borderColor: `${selectedTierColor}55` }}
              >
                This record only has geocoded municipal registry data. No Google Building
                Insights solar metrics were returned for it in the current export.
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 text-[10px] leading-snug text-zinc-500">
            Select a building marker to inspect its priority score, capacity, investment,
            CO2 offset, and payback availability.
          </div>
        )}
      </div>
    </div>
  );
}

function LayerRow({ layer }: { layer: LayerState }) {
  const def = getLegendDef(layer);
  const infoItems = getLegendInfoItems(layer);
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
      <InfoItems items={infoItems} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  layers: LayerState[];
  municipalSolarPanel?: MunicipalSolarPanelState | null;
}

export default function LegendPanel({ layers, municipalSolarPanel }: Props) {
  const [expanded, setExpanded] = useState(true);

  const activeLayers = layers.filter((l) => l.enabled && l.available);
  if (activeLayers.length === 0) return null;

  return (
    <div
      className="site-explorer-panel absolute bottom-0 right-4 z-[1001] w-[min(22rem,calc(100vw-2rem))] rounded-t-xl overflow-hidden flex flex-col"
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
          {municipalSolarPanel && <MunicipalSolarPanel panel={municipalSolarPanel} />}
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

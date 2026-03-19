import L from "leaflet";
import {
  getSolarColor,
  getPovertyColor,
} from "@/data/colors";
import {
  getMunicipalBuildingsSolarAnnualEnergyKwh,
  getMunicipalBuildingsSolarCapacityKw,
  getMunicipalBuildingsSolarDisplayName,
  getMunicipalBuildingsSolarInvestmentAmount,
  MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_COLORS,
  MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS,
} from "@/data/municipal-buildings-solar";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value: unknown, digits = 0): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getGeoJson(data: any): any {
  return data?.type === "FeatureCollection" ? data : data?.geoJson || data;
}

interface CreateLayerOptions {
  municipalSolarVisibleTiers?: Set<string>;
  selectedMunicipalSolarBuildingId?: number | string | null;
  onMunicipalSolarFeatureSelect?: (feature: any) => void;
}

export function createLayerFromData(
  layerId: string,
  data: any,
  options: CreateLayerOptions = {}
): L.Layer | null {
  if (!data) return null;

  switch (layerId) {
    case "rivers": {
      const geoJson = data.geoJson || data;
      if (!geoJson?.features) return null;
      return L.geoJSON(geoJson, {
        style: {
          color: "#06b6d4",
          weight: 2,
          opacity: 0.8,
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const name = feature.properties?.name || "Waterway";
          (layer as any).bindTooltip(name, { sticky: true });
        },
      });
    }

    case "transit_stops": {
      const geoJson = data?.type === "FeatureCollection" ? data : data?.geoJson || data;
      if (!geoJson?.features) return null;
      return L.geoJSON(geoJson, {
        pointToLayer: (_feature: any, latlng: L.LatLng) => {
          return L.circleMarker(latlng, {
            radius: 3,
            fillColor: "#14b8a6",
            color: "#0d9488",
            weight: 1,
            opacity: 0.9,
            fillOpacity: 0.7,
          });
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const p = feature.properties || {};
          const name = p.stop_name || p.name || "Bus stop";
          const code = p.stop_code ? ` (${p.stop_code})` : "";
          const html = `
            <div style="font-family: system-ui; font-size: 11px;">
              <strong>${name}</strong>${code}
            </div>
          `;
          (layer as any).bindTooltip(html, { sticky: true });
        },
      });
    }

    case "transit_routes": {
      const geoJson = data?.type === "FeatureCollection" ? data : data?.geoJson || data;
      if (!geoJson?.features) return null;
      return L.geoJSON(geoJson, {
        style: {
          color: "#06b6d4",
          weight: 1.5,
          opacity: 0.5,
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const p = feature.properties || {};
          const shapeId = p.shape_id || p.id || "Route";
          const html = `
            <div style="font-family: system-ui; font-size: 11px;">
              <strong>Route</strong>: ${shapeId}
            </div>
          `;
          (layer as any).bindTooltip(html, { sticky: true });
        },
      });
    }

    case "power_infrastructure": {
      const geoJson = data?.type === "FeatureCollection" ? data : data?.geoJson || data;
      if (!geoJson?.features) return null;

      const pointFeatures = geoJson.features.filter(
        (f: any) => f.geometry?.type === "Point"
      );
      const lineFeatures = geoJson.features.filter(
        (f: any) =>
          f.geometry?.type === "LineString" || f.geometry?.type === "MultiLineString"
      );

      const group = L.layerGroup();

      if (pointFeatures.length > 0) {
        L.geoJSON({ type: "FeatureCollection", features: pointFeatures } as any, {
          pointToLayer: (_feature: any, latlng: L.LatLng) => {
            return L.circleMarker(latlng, {
              radius: 5,
              fillColor: "#eab308",
              color: "#ca8a04",
              weight: 1,
              opacity: 0.9,
              fillOpacity: 0.8,
            });
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const p = feature.properties || {};
            const name = p.name || p.nome || p.id || "Substation";
            const type = p.type || p.tipo || p.obj_type || "substation";
            const voltage = p.voltage || p.tensao ? ` ${p.voltage || p.tensao}` : "";
            const html = `
              <div style="font-family: system-ui; font-size: 11px;">
                <strong>${name}</strong><br/>
                <span style="color: #94a3b8;">${type}${voltage}</span>
              </div>
            `;
            (layer as any).bindTooltip(html, { sticky: true });
          },
        }).addTo(group);
      }

      if (lineFeatures.length > 0) {
        L.geoJSON({ type: "FeatureCollection", features: lineFeatures } as any, {
          style: {
            color: "#eab308",
            weight: 2,
            opacity: 0.8,
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const p = feature.properties || {};
            const name = p.name || p.nome || p.id || "Transmission line";
            const voltage = p.voltage || p.tensao ? ` (${p.voltage || p.tensao})` : "";
            const html = `
              <div style="font-family: system-ui; font-size: 11px;">
                <strong>${name}</strong>${voltage}
              </div>
            `;
            (layer as any).bindTooltip(html, { sticky: true });
          },
        }).addTo(group);
      }

      return group;
    }

    case "solar_potential": {
      const geoJson = getGeoJson(data);
      if (!geoJson?.features) return null;
      return L.geoJSON(geoJson, {
        style: (feature: any) => {
          const pvout = feature?.properties?.PVOUT_mean || 0;
          const color = getSolarColor(pvout);
          return {
            color,
            fillColor: color,
            fillOpacity: 0.55,
            weight: 1,
            opacity: 0.8,
          };
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const p = feature.properties || {};
          const name = p.neighbourhood_name || p.name || "Neighbourhood";
          const pvout = p.PVOUT_mean?.toFixed(2) || "N/A";
          const ghi = p.GHI_mean?.toFixed(0) || "N/A";
          const html = `
            <div style="font-family: system-ui; font-size: 11px;">
              <strong>${name}</strong><br/>
              PV Output: ${pvout} kWh/kWp/day<br/>
              GHI: ${ghi} kWh/m\u00b2/year
            </div>
          `;
          (layer as any).bindTooltip(html, { sticky: true });
        },
      });
    }

    case "municipal_buildings_solar": {
      const geoJson = getGeoJson(data);
      if (!geoJson?.features) return null;
      const visibleTiers = options.municipalSolarVisibleTiers;
      const selectedBuildingId = options.selectedMunicipalSolarBuildingId ?? null;
      const filteredFeatures = Array.isArray(geoJson.features)
        ? geoJson.features.filter((feature: any) => {
            if (!visibleTiers || visibleTiers.size === 0) return true;
            const tier = feature?.properties?.priorityTier;
            return typeof tier === "string" && visibleTiers.has(tier);
          })
        : [];

      if (filteredFeatures.length === 0) {
        return L.layerGroup();
      }

      return L.geoJSON(
        {
          ...geoJson,
          features: filteredFeatures,
        },
        {
          pointToLayer: (feature: any, latlng: L.LatLng) => {
            const properties = feature?.properties || {};
            const tier = properties.priorityTier;
            const tierColor =
              MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_COLORS[
                tier as keyof typeof MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_COLORS
              ] ?? "#f59e0b";
            const baseRadius = tier === "high" ? 7 : tier === "medium" ? 6 : 5;
            const isSelected =
              selectedBuildingId !== null &&
              String(properties.municipalBuildingId ?? "") === String(selectedBuildingId);

            const marker = L.circleMarker(latlng, {
              radius: isSelected ? baseRadius + 1.5 : baseRadius,
              fillColor: tierColor,
              color: "#fff7ed",
              weight: isSelected ? 2 : 1.2,
              opacity: 0.95,
              fillOpacity: isSelected ? 1 : 0.9,
            });
            if (isSelected) {
              marker.on("add", () => marker.bringToFront());
            }
            return marker;
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const p = feature.properties || {};
            const tier = p.priorityTier;
            const tierLabel =
              MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS[
                tier as keyof typeof MUNICIPAL_BUILDINGS_SOLAR_PRIORITY_LABELS
              ] ?? "Priority";
            const displayName = getMunicipalBuildingsSolarDisplayName(p);
            const capacityKw = getMunicipalBuildingsSolarCapacityKw(p);
            const annualEnergyKwh = getMunicipalBuildingsSolarAnnualEnergyKwh(p);
            const investmentAmount = getMunicipalBuildingsSolarInvestmentAmount(p);
            const summaryBits = [
              isFiniteNumber(p.priorityScore)
                ? `Score ${formatNumber(p.priorityScore, 1)}`
                : null,
              capacityKw !== null ? `${formatNumber(capacityKw, 1)} kW` : null,
              annualEnergyKwh !== null ? `${formatNumber(annualEnergyKwh, 0)} kWh/yr` : null,
              investmentAmount !== null ? `BRL ${formatNumber(investmentAmount, 0)}` : null,
            ].filter(Boolean);

            (layer as any).bindTooltip(
              escapeHtml(
                `${tierLabel} · ${displayName}${
                  summaryBits.length > 0 ? ` · ${summaryBits.join(" · ")}` : ""
                }`
              ),
              { sticky: true }
            );
            if (options.onMunicipalSolarFeatureSelect) {
              layer.on("click", () => options.onMunicipalSolarFeatureSelect?.(feature));
            }
          },
        }
      );
    }

    case "ibge_census": {
      const geoJson = getGeoJson(data);
      if (!geoJson?.features) return null;
      return L.geoJSON(geoJson, {
        style: (feature: any) => {
          const rate = feature?.properties?.poverty_rate || 0;
          const color = getPovertyColor(rate);
          return {
            color,
            fillColor: color,
            fillOpacity: 0.55,
            weight: 1,
            opacity: 0.8,
          };
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const p = feature.properties || {};
          const name = p.neighbourhood_name || p.name || "Neighbourhood";
          const pop = p.population_total?.toLocaleString() || "N/A";
          const poverty = p.poverty_rate != null ? (p.poverty_rate * 100).toFixed(1) + "%" : "N/A";
          const lowIncome = p.pct_low_income != null ? (p.pct_low_income * 100).toFixed(1) + "%" : "N/A";
          const highIncome = p.pct_high_income != null ? (p.pct_high_income * 100).toFixed(1) + "%" : "N/A";
          const water = p.pct_piped_water != null ? (p.pct_piped_water * 100).toFixed(1) + "%" : "N/A";
          const sewage = p.pct_formal_sewage != null ? (p.pct_formal_sewage * 100).toFixed(1) + "%" : "N/A";
          const density = p.pop_density_km2?.toFixed(0) || "N/A";
          const html = `
            <div style="font-family: system-ui; font-size: 11px;">
              <strong>${name}</strong><br/>
              Population: ${pop}<br/>
              Poverty rate: ${poverty}<br/>
              Low income: ${lowIncome} | High income: ${highIncome}<br/>
              Piped water: ${water} | Sewage: ${sewage}<br/>
              Density: ${density}/km\u00b2
            </div>
          `;
          (layer as any).bindTooltip(html, { sticky: true });
        },
      });
    }

    case "ibge_settlements": {
      const geoJson = getGeoJson(data);
      if (!geoJson?.features) return null;
      return L.geoJSON(geoJson, {
        style: {
          color: "#f43f5e",
          fillColor: "#e11d48",
          fillOpacity: 0.45,
          weight: 1.5,
          opacity: 0.8,
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const p = feature.properties || {};
          const name = p.settlement_name || p.name || "Informal settlement";
          const html = `
            <div style="font-family: system-ui; font-size: 11px;">
              <strong>${name}</strong>
            </div>
          `;
          (layer as any).bindTooltip(html, { sticky: true });
        },
      });
    }

    case "iptu-neighbourhoods": {
      const geoJson = getGeoJson(data);
      if (!geoJson?.features) return null;
      return L.geoJSON(geoJson, {
        style: (feature: any) => {
          const p = feature.properties || {};
          const totalIPTU = p.iptu_lancado_rs || 0;
          // Normalize to 0-1 scale (adjust max based on your data)
          const maxIPTU = 111539396; // From visual inspection of data (Petrópolis max)
          const normalized = Math.min(totalIPTU / maxIPTU, 1);
          
          // Blue gradient: light to dark
          const colors = ["#dbeafe","#93c5fd","#3b82f6","#1d4ed8","#1e3a8a"];
          const colorIndex = Math.floor(normalized * (colors.length - 1));
          
          return {
            color: "#1e40af",
            fillColor: colors[colorIndex],
            fillOpacity: 0.65,
            weight: 1.5,
            opacity: 0.9,
          };
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const p = feature.properties || {};
          const name = p.neighbourhood_name || "Unknown";
          const iptuTotal = (p.total_rs || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const registros = p.registros || 0;
          const html = `
            <div style="font-family: system-ui; font-size: 11px; max-width: 200px;">
              <strong>${name}</strong><br/>
              Total: ${iptuTotal}<br/>
              Properties: ${registros}
            </div>
          `;
          (layer as any).bindPopup(html, { maxWidth: 240 });
        },
      });
    }

    case "sites_flood2024": {
      const geoJson = data?.geoJson || data;
      if (!geoJson?.features) return null;
      return L.geoJSON(geoJson, {
        style: (feature: any) => {
          const type = feature?.properties?.obj_type || feature?.properties?.notation || "flood";
          const isExtent = type === "AffectedArea" || type === "Flooded";
          return {
            color: "#60a5fa",
            fillColor: isExtent ? "#1d4ed8" : "#3b82f6",
            fillOpacity: 0.35,
            weight: 1.5,
            opacity: 0.85,
            dashArray: isExtent ? undefined : "4 2",
          };
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const p = feature.properties || {};
          const date = p.event_date || "2024-05-06";
          const src = p.data_source ? "Planet/SkySat satellite" : "2024 Flood";
          const html = `
            <div style="font-family: system-ui; font-size: 11px;">
              <strong>Observed flood inundation</strong><br/>
              <span style="color: #60a5fa;">Date: ${date} (flood peak)</span><br/>
              <span style="color: #94a3b8;">Source: ${src}</span><br/>
              <span style="color: #94a3b8;">Guaíba watershed — Rio Grande do Sul</span>
            </div>
          `;
          (layer as any).bindTooltip(html, { sticky: true });
        },
      });
    }

    case "sites_flood_zones": {
      const geoJson = data?.geoJson || data;
      if (!geoJson?.features) return null;

      return L.geoJSON(geoJson, {
        style: (feature: any) => {
          const natural = feature?.properties?.natural || "";
          const waterway = feature?.properties?.waterway || "";
          const isWater = natural === "water";
          const isWetland = natural === "wetland";
          const isRiverbank = waterway === "riverbank";
          return {
            color: isWater ? "#1e40af" : "#2563eb",
            fillColor: isWater ? "#1d4ed8" : isWetland ? "#3b82f6" : isRiverbank ? "#60a5fa" : "#93c5fd",
            fillOpacity: isWater ? 0.55 : 0.4,
            weight: isWater ? 1.5 : 1,
            opacity: 0.85,
            dashArray: isWater ? undefined : "4 3",
          };
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const p = feature.properties || {};
          const name = p.name || (p.natural === "water" ? "Water body" : p.natural === "wetland" ? "Wetland" : "Flood zone");
          const type = p.natural || p.waterway || "water feature";
          const water = p.water ? ` (${p.water})` : "";
          const html = `
            <div style="font-family: system-ui; font-size: 11px;">
              <strong>${name}</strong><br/>
              <span style="color: #94a3b8;">Type: ${type}${water}</span><br/>
              <span style="color: #60a5fa;">Flood risk zone — NbS priority area</span><br/>
              <span style="color: #94a3b8;">Source: OpenStreetMap</span>
            </div>
          `;
          (layer as any).bindTooltip(html, { sticky: true });
        },
      });
    }

    case "sites_parks":
    case "sites_schools":
    case "sites_hospitals":
    case "sites_wetlands":
    case "sites_sports":
    case "sites_social":
    case "sites_vacant": {
      const geoJson = data?.geoJson || data;
      if (!geoJson?.features) return null;

      const siteColors: Record<string, string> = {
        sites_parks:     "#22c55e",
        sites_schools:   "#f59e0b",
        sites_hospitals: "#ef4444",
        sites_wetlands:  "#3b82f6",
        sites_sports:    "#8b5cf6",
        sites_social:    "#ec4899",
        sites_vacant:    "#a16207",
      };

      const siteNames: Record<string, string> = {
        sites_parks:     "Park / Green Space",
        sites_schools:   "School / Education",
        sites_hospitals: "Hospital / Health Facility",
        sites_wetlands:  "Wetland",
        sites_sports:    "Sports Ground / Plaza",
        sites_social:    "Community Facility",
        sites_vacant:    "Vacant / Brownfield Land",
      };

      const color = siteColors[layerId] || "#94a3b8";
      const typeName = siteNames[layerId] || "Site";

      const group = L.layerGroup();

      const polygonFeatures = geoJson.features.filter(
        (f: any) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
      );
      const pointFeatures = geoJson.features.filter(
        (f: any) => f.geometry?.type === "Point"
      );

      if (polygonFeatures.length > 0) {
        L.geoJSON({ type: "FeatureCollection", features: polygonFeatures } as any, {
          style: {
            color,
            fillColor: color,
            fillOpacity: 0.25,
            weight: 1.5,
            opacity: 0.9,
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const p = feature.properties || {};
            const name = p.name || p.tags?.name || typeName;
            const html = `
              <div style="font-family: system-ui; font-size: 11px;">
                <strong>${name}</strong><br/>
                <span style="color: #94a3b8;">${typeName}</span>
              </div>
            `;
            (layer as any).bindTooltip(html, { sticky: true });
          },
        }).addTo(group);
      }

      if (pointFeatures.length > 0) {
        L.geoJSON({ type: "FeatureCollection", features: pointFeatures } as any, {
          pointToLayer: (_feature: any, latlng: L.LatLng) => {
            return L.circleMarker(latlng, {
              radius: 5,
              fillColor: color,
              color: "#ffffff",
              weight: 1,
              opacity: 0.9,
              fillOpacity: 0.8,
            });
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const p = feature.properties || {};
            const name = p.name || p.tags?.name || typeName;
            const html = `
              <div style="font-family: system-ui; font-size: 11px;">
                <strong>${name}</strong><br/>
                <span style="color: #94a3b8;">${typeName}</span>
              </div>
            `;
            (layer as any).bindTooltip(html, { sticky: true });
          },
        }).addTo(group);
      }

      return group;
    }

    case "obm-buildings": {
      const geoJson = getGeoJson(data);
      if (!geoJson?.features) return null;
      
      const buildingTypeColors: Record<string, string> = {
        "Residential (single-family)": "#3B82F6",     // Blue
        "Multi-family residential": "#06B6D4",        // Cyan
        "Commercial": "#F59E0B",                      // Amber
        "Industrial": "#8B5CF6",                      // Purple
        "Agricultural": "#22C55E",                    // Green
        "Education": "#EC4899",                       // Pink
        "Government": "#DC2626",                      // Red
        "Assembly": "#F97316",                        // Orange
        "Mixed-use": "#14B8A6",                       // Teal
      };
      
      return L.geoJSON(geoJson, {
        pointToLayer: (feature: any, latlng) => {
          const buildingType = feature.properties?.building_type || "Unknown";
          const color = buildingTypeColors[buildingType] || feature.properties?.color || "#6B7280";
          return L.circleMarker(latlng, {
            radius: 4,
            fillOpacity: 0.8,
            weight: 0.5,
            opacity: 0.9,
            color,
            fillColor: color,
          });
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const buildingType = feature.properties?.building_type || "Unknown";
          const height = feature.properties?.height ? ` (${feature.properties.height}m)` : "";
          const source = feature.properties?.source ? ` [${feature.properties.source}]` : "";
          const popupText = `<strong>${buildingType}</strong>${height}${source}`;
          (layer as any).bindPopup(popupText);
          (layer as any).bindTooltip(buildingType, { sticky: true });
        },
      });
    }

    default:
      return null;
  }
}

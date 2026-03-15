import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LAYER_CONFIGS, type LayerState } from "@/data/layer-configs";
import {
  getFloodColor,
  getHeatColor,
  getLandslideColor,
  getPopulationColor,
  getBuildingColor,
  getSolarColor,
  getPovertyColor,
  LANDCOVER_COLORS,
} from "@/data/colors";
import { loadBoundaryData, loadLayerData } from "@/data/sample-data-loaders";
import Header from "@/components/layout/Header";
import EvidenceDrawer from "./EvidenceDrawer";

export default function MapViewer() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const layerRefsMap = useRef<Map<string, L.Layer>>(new Map());
  const dataCache = useRef<Map<string, any>>(new Map());

  const [layers, setLayers] = useState<LayerState[]>(
    LAYER_CONFIGS.map((config) => ({
      ...config,
      enabled: false,
      loaded: false,
      loading: false,
      data: null,
    }))
  );

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      try {
        const boundaryData = await loadBoundaryData();

        if (!mapContainerRef.current || cancelled || mapRef.current) return;

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
              color: "#ffffff",
              weight: 2,
              fillOpacity: 0,
              dashArray: "8, 4",
              opacity: 0.6,
            },
          }).addTo(map);

          if (boundaryData.bbox) {
            const [s, w, n, e] = boundaryData.bbox;
            map.fitBounds([[s, w], [n, e]]);
          }
        }

        mapRef.current = map;
        setMapReady(true);

        if (mapContainerRef.current) {
          const observer = new ResizeObserver(() => {
            map.invalidateSize();
          });
          observer.observe(mapContainerRef.current);
          observerRef.current = observer;
        }
      } catch (error: any) {
        if (error?.message?.includes("already initialized") || cancelled) return;
        console.error("Failed to initialize map:", error);
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
          center: [-30.0346, -51.2177],
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

        mapRef.current = map;
        setMapReady(true);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const createLayerFromData = useCallback(
    (layerId: string, data: any): L.Layer | null => {
      if (!data) return null;

      switch (layerId) {
        case "grid_flood":
        case "grid_heat":
        case "grid_landslide":
        case "grid_population":
        case "grid_buildings": {
          const geoJson = data.geoJson || data;
          if (!geoJson?.features) return null;

          const metricKey: Record<string, string> = {
            grid_flood: "flood_score",
            grid_heat: "heat_score",
            grid_landslide: "landslide_score",
            grid_population: "pop_density",
            grid_buildings: "building_density",
          };

          const colorFn: Record<string, (v: number) => string> = {
            grid_flood: getFloodColor,
            grid_heat: getHeatColor,
            grid_landslide: getLandslideColor,
            grid_population: getPopulationColor,
            grid_buildings: getBuildingColor,
          };

          const key = metricKey[layerId];
          const getColor = colorFn[layerId];

          return L.geoJSON(geoJson, {
            style: (feature: any) => {
              const score = feature?.properties?.metrics?.[key] || 0;
              return {
                color: getColor(score),
                fillColor: getColor(score),
                fillOpacity: score > 0 ? 0.6 : 0.1,
                weight: 0.5,
                opacity: 0.8,
              };
            },
            onEachFeature: (feature: any, layer: L.Layer) => {
              const score = feature.properties?.metrics?.[key] || 0;
              const html = `
                <div style="font-family: system-ui; font-size: 11px;">
                  <strong>${layerId.replace("grid_", "").replace("_", " ")}</strong>: ${(score * 100).toFixed(0)}%
                </div>
              `;
              (layer as any).bindTooltip(html, { sticky: true });
            },
          });
        }

        case "elevation": {
          const contours = data.contours || data;
          if (!contours?.features) return null;
          return L.geoJSON(contours, {
            style: {
              color: "#c9a87c",
              weight: 1,
              opacity: 0.6,
            },
            onEachFeature: (feature: any, layer: L.Layer) => {
              const elev = feature.properties?.elevation || feature.properties?.ele;
              if (elev) {
                (layer as any).bindTooltip(`${elev}m`, { sticky: true });
              }
            },
          });
        }

        case "landcover": {
          const geoJson = data.geoJson || data;
          if (!geoJson?.features) return null;
          return L.geoJSON(geoJson, {
            style: (feature: any) => {
              const cls = feature?.properties?.landcover_class || "bareVegetation";
              const color = LANDCOVER_COLORS[cls] || "#DEB887";
              return {
                color,
                fillColor: color,
                fillOpacity: 0.5,
                weight: 0.5,
              };
            },
            onEachFeature: (feature: any, layer: L.Layer) => {
              const cls = feature.properties?.landcover_class || "unknown";
              (layer as any).bindTooltip(`Land cover: ${cls}`, { sticky: true });
            },
          });
        }

        case "surface_water": {
          const geoJson = data.geoJson || data;
          if (!geoJson?.features) return null;
          return L.geoJSON(geoJson, {
            style: {
              color: "#3b82f6",
              fillColor: "#1e40af",
              fillOpacity: 0.4,
              weight: 1,
            },
            onEachFeature: (feature: any, layer: L.Layer) => {
              const name = feature.properties?.name || "Water body";
              (layer as any).bindTooltip(name, { sticky: true });
            },
          });
        }

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

        case "forest": {
          const geoJson = data.geoJson || data;
          if (!geoJson?.features) return null;
          return L.geoJSON(geoJson, {
            style: {
              color: "#22c55e",
              fillColor: "#166534",
              fillOpacity: 0.4,
              weight: 1,
            },
            onEachFeature: (feature: any, layer: L.Layer) => {
              const name = feature.properties?.name || "Forest area";
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

        case "solar_potential": {
          const geoJson = data?.type === "FeatureCollection" ? data : data?.geoJson || data;
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

        case "ibge_census": {
          const geoJson = data?.type === "FeatureCollection" ? data : data?.geoJson || data;
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
          const geoJson = data?.type === "FeatureCollection" ? data : data?.geoJson || data;
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
            L.geoJSON({ type: "FeatureCollection", features: polygonFeatures }, {
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
            L.geoJSON({ type: "FeatureCollection", features: pointFeatures }, {
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

        default:
          return null;
      }
    },
    []
  );

  const toggleLayer = useCallback(
    async (layerId: string) => {
      const map = mapRef.current;
      if (!map) return;

      const layerState = layers.find((l) => l.id === layerId);
      if (!layerState || !layerState.available) return;

      if (layerState.enabled) {
        const existingLayer = layerRefsMap.current.get(layerId);
        if (existingLayer) {
          map.removeLayer(existingLayer);
          layerRefsMap.current.delete(layerId);
        }
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, enabled: false } : l))
        );
        return;
      }

      if (layerState.source === "tiles") {
        const tileLayerId = layerState.tileLayerId;
        if (!tileLayerId) return;

        // GIBS WMTS layers (VIIRS, MODIS) have lower maxNativeZoom than regular tiles.
        // Server-side clamping handles zoom > maxNativeZoom, but Leaflet needs the hint
        // to avoid stretching tiles unnecessarily at low zoom levels.
        const gibsMaxZoom: Record<string, number> = { viirs_i5_day: 9 };
        const isGibsLayer = tileLayerId in gibsMaxZoom;
        const tileUrl = `/api/geospatial/tiles/${tileLayerId}/{z}/{x}/{y}.png`;
        const tileLayer = L.tileLayer(tileUrl, {
          opacity: 0.7,
          maxNativeZoom: isGibsLayer ? gibsMaxZoom[tileLayerId!] : 15,
          maxZoom: 19,
          minZoom: isGibsLayer ? 0 : 10,
          errorTileUrl: "",
          className: "oef-tile-layer",
        });

        tileLayer.addTo(map);
        layerRefsMap.current.set(layerId, tileLayer);
        setLayers((prev) =>
          prev.map((l) =>
            l.id === layerId ? { ...l, enabled: true, loaded: true } : l
          )
        );
        return;
      }

      const cachedData = dataCache.current.get(layerId);
      if (cachedData) {
        const leafletLayer = createLayerFromData(layerId, cachedData);
        if (leafletLayer) {
          leafletLayer.addTo(map);
          layerRefsMap.current.set(layerId, leafletLayer);
        }
        setLayers((prev) =>
          prev.map((l) =>
            l.id === layerId ? { ...l, enabled: true, loaded: true } : l
          )
        );
        return;
      }

      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, loading: true } : l))
      );

      try {
        const data = await loadLayerData(layerId);
        if (data) {
          dataCache.current.set(layerId, data);
          const leafletLayer = createLayerFromData(layerId, data);
          if (leafletLayer) {
            leafletLayer.addTo(map);
            layerRefsMap.current.set(layerId, leafletLayer);
            setLayers((prev) =>
              prev.map((l) =>
                l.id === layerId
                  ? { ...l, enabled: true, loaded: true, loading: false, data }
                  : l
              )
            );
          } else {
            setLayers((prev) =>
              prev.map((l) =>
                l.id === layerId ? { ...l, loading: false } : l
              )
            );
          }
        } else {
          setLayers((prev) =>
            prev.map((l) =>
              l.id === layerId ? { ...l, loading: false } : l
            )
          );
        }
      } catch (error) {
        console.error(`Failed to load layer ${layerId}:`, error);
        setLayers((prev) =>
          prev.map((l) =>
            l.id === layerId ? { ...l, loading: false } : l
          )
        );
      }
    },
    [layers, createLayerFromData]
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 dark">
      <Header />

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={mapContainerRef}
          data-testid="map-container"
          className="absolute inset-0"
          style={{ zIndex: 0 }}
        />

        <EvidenceDrawer layers={layers} onToggleLayer={toggleLayer} />

        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-[2000]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">Initializing map...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { LAYER_CONFIGS, type LayerState } from "@/data/layer-configs";
import {
  getFloodColor,
  getHeatColor,
  getLandslideColor,
  getPopulationColor,
  getBuildingColor,
  LANDCOVER_COLORS,
} from "@/data/colors";
import { loadBoundaryData, loadLayerData } from "@/data/sample-data-loaders";
import Header from "@/components/layout/Header";
import EvidenceDrawer from "./EvidenceDrawer";
import CityCatalystTab from "../layout/CityCatalystTab";

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

        const tileUrl = `/api/geospatial/tiles/${tileLayerId}/{z}/{x}/{y}.png`;
        const tileLayer = L.tileLayer(tileUrl, {
          opacity: 0.7,
          maxNativeZoom: 15,
          maxZoom: 19,
          minZoom: 10,
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
        <CityCatalystTab />

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

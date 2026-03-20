import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LAYER_CONFIGS, type LayerState } from "@/data/layer-configs";
import { loadBoundaryData, loadLayerData } from "@/data/sample-data-loaders";
import {
  MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID,
  type MunicipalBuildingsSolarPriorityTier,
} from "@/data/municipal-buildings-solar";
import { sampleRasterAtPoint, geometryCentroid, linestringMidpoint } from "@/lib/valueTileUtils";
import { createLayerFromData } from "@/lib/layerFactory";
import Header from "@/components/layout/Header";
import EvidenceDrawer from "./EvidenceDrawer";
import LegendPanel from "./LegendPanel";
import ValueTooltip from "./ValueTooltip";

const DEFAULT_MUNICIPAL_SOLAR_TIERS: Record<
  MunicipalBuildingsSolarPriorityTier,
  boolean
> = {
  high: true,
  medium: true,
  low: true,
  unscored: true,
};

export default function MapViewer() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const layerRefsMap = useRef<Map<string, L.Layer>>(new Map());

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
  const [municipalSolarVisibleTiers, setMunicipalSolarVisibleTiers] = useState(
    DEFAULT_MUNICIPAL_SOLAR_TIERS
  );
  const [selectedMunicipalSolarFeature, setSelectedMunicipalSolarFeature] =
    useState<any | null>(null);

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
        if (layerId === MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID) {
          setMunicipalSolarVisibleTiers(DEFAULT_MUNICIPAL_SOLAR_TIERS);
          setSelectedMunicipalSolarFeature(null);
        }
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, enabled: false } : l))
        );
        return;
      }

      // ── Postprocessed spatial query layers ────────────────────────────────
      if (layerId === "post_settlements_flood" || layerId === "post_bus_heatwave") {
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, loading: true } : l))
        );

        try {
          const leafletLayer = await buildPostprocessedLayer(layerId);
          if (leafletLayer) {
            leafletLayer.addTo(map);
            layerRefsMap.current.set(layerId, leafletLayer);
            setLayers((prev) =>
              prev.map((l) =>
                l.id === layerId ? { ...l, enabled: true, loaded: true, loading: false } : l
              )
            );
          } else {
            setLayers((prev) =>
              prev.map((l) => (l.id === layerId ? { ...l, loading: false } : l))
            );
          }
        } catch (err) {
          console.error(`Postprocessed layer ${layerId} failed:`, err);
          setLayers((prev) =>
            prev.map((l) => (l.id === layerId ? { ...l, loading: false } : l))
          );
        }
        return;
      }

      if (layerId === MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID) {
        setLayers((prev) =>
          prev.map((l) => (l.id === layerId ? { ...l, loading: true } : l))
        );

        try {
          const data = await loadLayerData(layerId);
          if (!data) {
            setLayers((prev) =>
              prev.map((l) => (l.id === layerId ? { ...l, loading: false } : l))
            );
            return;
          }

          setMunicipalSolarVisibleTiers(DEFAULT_MUNICIPAL_SOLAR_TIERS);
          setSelectedMunicipalSolarFeature(null);
          setLayers((prev) =>
            prev.map((l) =>
              l.id === layerId
                ? { ...l, enabled: true, loaded: true, loading: false, data }
                : l
            )
          );
        } catch (error) {
          console.error(`Failed to load layer ${layerId}:`, error);
          setLayers((prev) =>
            prev.map((l) => (l.id === layerId ? { ...l, loading: false } : l))
          );
        }
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

      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, loading: true } : l))
      );

      try {
        const data = await loadLayerData(layerId);
        if (data) {
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
    [layers]
  );

  const municipalSolarLayerState =
    layers.find((layer) => layer.id === MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID) ?? null;
  const municipalSolarSelectedBuildingId =
    selectedMunicipalSolarFeature?.properties?.municipalBuildingId ?? null;

  const toggleMunicipalSolarTier = useCallback(
    (tier: MunicipalBuildingsSolarPriorityTier) => {
      setMunicipalSolarVisibleTiers((prev) => ({
        ...prev,
        [tier]: !prev[tier],
      }));
    },
    []
  );

  useEffect(() => {
    const tier = selectedMunicipalSolarFeature?.properties?.priorityTier;
    if (
      tier &&
      typeof tier === "string" &&
      tier in municipalSolarVisibleTiers &&
      !municipalSolarVisibleTiers[tier as MunicipalBuildingsSolarPriorityTier]
    ) {
      setSelectedMunicipalSolarFeature(null);
    }
  }, [municipalSolarVisibleTiers, selectedMunicipalSolarFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existingLayer = layerRefsMap.current.get(MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID);
    if (!municipalSolarLayerState?.enabled || !municipalSolarLayerState.data) {
      if (existingLayer) {
        map.removeLayer(existingLayer);
        layerRefsMap.current.delete(MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID);
      }
      return;
    }

    if (existingLayer) {
      map.removeLayer(existingLayer);
      layerRefsMap.current.delete(MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID);
    }

    const visibleTierSet = new Set(
      Object.entries(municipalSolarVisibleTiers)
        .filter(([, enabled]) => enabled)
        .map(([tier]) => tier)
    );

    const layer = createLayerFromData(
      MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID,
      municipalSolarLayerState.data,
      {
        municipalSolarVisibleTiers: visibleTierSet,
        selectedMunicipalSolarBuildingId: municipalSolarSelectedBuildingId,
        onMunicipalSolarFeatureSelect: (feature) =>
          setSelectedMunicipalSolarFeature(feature),
      }
    );

    if (!layer) return;

    layer.addTo(map);
    layerRefsMap.current.set(MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID, layer);

    return () => {
      const currentLayer = layerRefsMap.current.get(MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID);
      if (currentLayer === layer) {
        map.removeLayer(layer);
        layerRefsMap.current.delete(MUNICIPAL_BUILDINGS_SOLAR_LAYER_ID);
      }
    };
  }, [
    municipalSolarLayerState?.enabled,
    municipalSolarLayerState?.data,
    municipalSolarSelectedBuildingId,
    municipalSolarVisibleTiers,
  ]);

  // Builds a Leaflet layer by filtering vector features against a raster threshold.
  // Runs entirely client-side: loads the source GeoJSON, samples the value tile at
  // each feature's centroid/midpoint, then keeps only features above the threshold.
  async function buildPostprocessedLayer(layerId: string): Promise<L.Layer | null> {
    if (layerId === "post_settlements_flood") {
      const data = await loadLayerData("ibge_settlements");
      const geoJson = data?.geoJson || data;
      if (!geoJson?.features) return null;

      const friConfig = LAYER_CONFIGS.find((l) => l.id === "oef_fri_2024");
      const enc = friConfig?.valueEncoding;
      if (!enc?.urlTemplate) return null;

      const THRESHOLD = 0.4;
      const passed: any[] = [];

      for (const feature of geoJson.features) {
        const centroid = geometryCentroid(feature.geometry);
        if (!centroid) continue;
        const value = await sampleRasterAtPoint(centroid[0], centroid[1], enc, 11);
        if (value !== null && value > THRESHOLD) {
          passed.push({ ...feature, properties: { ...feature.properties, fri_value: value } });
        }
      }

      if (passed.length === 0) return null;

      return L.geoJSON(
        { type: "FeatureCollection", features: passed } as any,
        {
          style: {
            color: "#ef4444",
            fillColor: "#dc2626",
            fillOpacity: 0.7,
            weight: 2.5,
            opacity: 1,
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const p = feature.properties || {};
            const name = p.settlement_name || p.name || "Informal settlement";
            const fri = p.fri_value?.toFixed(3) ?? "?";
            (layer as any).bindTooltip(
              `<div style="font-family:system-ui;font-size:11px;">
                <strong style="color:#ef4444">⚠ High flood risk</strong><br/>
                <strong>${name}</strong><br/>
                Flood Risk Index: <strong>${fri}</strong> <span style="color:#94a3b8">(threshold: 0.4)</span><br/>
                <span style="color:#94a3b8">Source: OEF FRI 2024 × IBGE settlements</span>
               </div>`,
              { sticky: true }
            );
          },
        }
      );
    }

    if (layerId === "post_bus_heatwave") {
      const data = await loadLayerData("transit_routes");
      const geoJson = data?.type === "FeatureCollection" ? data : data?.geoJson || data;
      if (!geoJson?.features) return null;

      const hwmConfig = LAYER_CONFIGS.find((l) => l.id === "oef_hwm_2024");
      const enc = hwmConfig?.valueEncoding;
      if (!enc?.urlTemplate) return null;

      const THRESHOLD = 10; // °C·days
      const passed: any[] = [];

      for (const feature of geoJson.features) {
        const mid = linestringMidpoint(feature.geometry);
        if (!mid) continue;
        const value = await sampleRasterAtPoint(mid[0], mid[1], enc, 11);
        if (value !== null && value >= THRESHOLD) {
          passed.push({ ...feature, properties: { ...feature.properties, hwm_value: value } });
        }
      }

      if (passed.length === 0) return null;

      return L.geoJSON(
        { type: "FeatureCollection", features: passed } as any,
        {
          style: {
            color: "#fb923c",
            weight: 3,
            opacity: 0.95,
          },
          onEachFeature: (feature: any, layer: L.Layer) => {
            const p = feature.properties || {};
            const routeId = p.shape_id || p.id || "Route";
            const hwm = p.hwm_value?.toFixed(1) ?? "?";
            (layer as any).bindTooltip(
              `<div style="font-family:system-ui;font-size:11px;">
                <strong style="color:#fb923c">🌡 Heatwave zone</strong><br/>
                <strong>Bus Route ${routeId}</strong><br/>
                Heatwave Magnitude: <strong>${hwm} °C·days</strong> <span style="color:#94a3b8">(threshold: 10)</span><br/>
                <span style="color:#94a3b8">Source: ERA5 HWM 2024 × GTFS transit routes</span>
               </div>`,
              { sticky: true }
            );
          },
        }
      );
    }

    return null;
  }

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

        <ValueTooltip mapRef={mapRef} layers={layers} mapReady={mapReady} />
        <EvidenceDrawer layers={layers} onToggleLayer={toggleLayer} />
        <LegendPanel
          layers={layers}
          municipalSolarPanel={
            municipalSolarLayerState?.enabled && municipalSolarLayerState.data
              ? {
                  data: municipalSolarLayerState.data,
                  visibleTiers: municipalSolarVisibleTiers,
                  onToggleTier: toggleMunicipalSolarTier,
                  selectedFeature: selectedMunicipalSolarFeature,
                  onClearSelectedFeature: () => setSelectedMunicipalSolarFeature(null),
                }
              : null
          }
        />

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

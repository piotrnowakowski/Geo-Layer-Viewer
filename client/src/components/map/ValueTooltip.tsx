import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import type { LayerState } from "@/data/layer-configs";

interface Props {
  mapRef: React.RefObject<L.Map | null>;
  layers: LayerState[];
  mapReady: boolean;
}

interface TooltipState {
  x: number;
  y: number;
  lines: { label: string; value: string; unit?: string; color: string }[];
}

// ── Lat/lng → tile coordinate + pixel offset ─────────────────────────────────
function latLngToTilePixel(lat: number, lng: number, z: number) {
  const n = Math.pow(2, z);
  const latR = (lat * Math.PI) / 180;
  const mercY = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2;

  const tileX = Math.floor(((lng + 180) / 360) * n);
  const tileY = Math.floor(mercY * n);

  const px = Math.floor((((lng + 180) / 360) * n - tileX) * 256);
  const py = Math.floor((mercY * n - tileY) * 256);

  return {
    tileX: Math.max(0, Math.min(n - 1, tileX)),
    tileY: Math.max(0, Math.min(n - 1, tileY)),
    px: Math.max(0, Math.min(255, px)),
    py: Math.max(0, Math.min(255, py)),
  };
}

// ── Tile image cache (keyed by proxied URL) ───────────────────────────────────
const tileCache = new Map<string, ImageData | null>();
const pendingTiles = new Map<string, Promise<ImageData | null>>();

async function fetchTilePixels(s3Url: string): Promise<ImageData | null> {
  if (tileCache.has(s3Url)) return tileCache.get(s3Url)!;
  if (pendingTiles.has(s3Url)) return pendingTiles.get(s3Url)!;

  const proxyUrl = `/api/geospatial/proxy-tile?url=${encodeURIComponent(s3Url)}`;

  const promise = new Promise<ImageData | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) { tileCache.set(s3Url, null); resolve(null); return; }
      ctx.drawImage(img, 0, 0, 256, 256);
      const data = ctx.getImageData(0, 0, 256, 256);
      tileCache.set(s3Url, data);
      resolve(data);
    };
    img.onerror = () => { tileCache.set(s3Url, null); resolve(null); };
    img.src = proxyUrl;
  });

  pendingTiles.set(s3Url, promise);
  const result = await promise;
  pendingTiles.delete(s3Url);
  return result;
}

// ── Sample a single pixel from an ImageData ───────────────────────────────────
function samplePixel(imgData: ImageData, px: number, py: number): [number, number, number, number] {
  const i = (py * 256 + px) * 4;
  return [imgData.data[i], imgData.data[i + 1], imgData.data[i + 2], imgData.data[i + 3]];
}

// ── Decode OEF value tile pixel → human-readable string ─────────────────────
function decodePixel(
  r: number, g: number, b: number, alpha: number,
  encoding: NonNullable<LayerState["valueEncoding"]>
): string | null {
  if (alpha < 10) return null;

  if (encoding.type === "categorical") {
    const classId = r;
    const className = encoding.classes?.[classId];
    return className ?? `Class ${classId}`;
  }

  // numeric: value = (R + 256*G + 65536*B + offset) / scale
  const raw = r + 256 * g + 65536 * b;
  const scale = encoding.scale ?? 100;
  const offset = encoding.offset ?? 0;
  const value = (raw + offset) / scale;

  if (!isFinite(value) || value < -9000) return null;

  if (encoding.unit === "index 0–1") {
    return value.toFixed(3);
  }
  if (encoding.unit?.includes("°C")) {
    return value.toFixed(1);
  }
  return value.toFixed(1);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ValueTooltip({ mapRef, layers, mapReady }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Layers that can produce values
  const activeValueLayers = layers.filter(
    (l) => l.enabled && l.hasValueTiles && l.valueEncoding?.urlTemplate
  );

  const handleMouseMove = useCallback(
    async (e: L.LeafletMouseEvent) => {
      const map = mapRef.current;
      if (!map || activeValueLayers.length === 0) {
        setTooltip(null);
        return;
      }

      // Convert map container point → screen coords
      const containerPoint = e.containerPoint;
      const screenX = containerPoint.x;
      const screenY = containerPoint.y;

      // Debounce the expensive fetch work
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        const { lat, lng } = e.latlng;
        const rawZ = Math.round(map.getZoom());
        const sampleZ = Math.max(10, Math.min(15, rawZ));
        const { tileX, tileY, px, py } = latLngToTilePixel(lat, lng, sampleZ);

        const lines: TooltipState["lines"] = [];

        for (const layer of activeValueLayers) {
          const enc = layer.valueEncoding!;
          const tileUrl = enc.urlTemplate!
            .replace("{z}", String(sampleZ))
            .replace("{x}", String(tileX))
            .replace("{y}", String(tileY));

          try {
            const imgData = await fetchTilePixels(tileUrl);
            if (!imgData) continue;

            const [r, g, b, a] = samplePixel(imgData, px, py);
            const decoded = decodePixel(r, g, b, a, enc);
            if (decoded === null) continue;

            lines.push({
              label: layer.name,
              value: decoded,
              unit: enc.type === "categorical" ? undefined : enc.unit,
              color: layer.color,
            });
          } catch {
            // silently skip failed tiles
          }
        }

        if (lines.length > 0) {
          setTooltip({ x: screenX, y: screenY, lines });
        } else {
          setTooltip(null);
        }
      }, 120);
    },
    [activeValueLayers, mapRef]
  );

  const handleMouseOut = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setTooltip(null);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseOut);

    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseOut);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mapReady, mapRef, handleMouseMove, handleMouseOut]);

  if (!tooltip || tooltip.lines.length === 0) return null;

  // Keep tooltip inside the map container (right or left of cursor)
  const containerWidth = mapRef.current?.getContainer()?.offsetWidth ?? window.innerWidth;
  const flipLeft = tooltip.x > containerWidth * 0.65;
  const offsetX = flipLeft ? -12 : 14;
  const offsetY = -12;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: tooltip.x + offsetX,
        top: tooltip.y + offsetY,
        transform: flipLeft ? "translateX(-100%)" : "none",
        pointerEvents: "none",
        zIndex: 2000,
      }}
      className="bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-xl px-2.5 py-2 min-w-[140px] max-w-[220px] backdrop-blur-sm"
    >
      {tooltip.lines.map((line, i) => (
        <div key={i} className={i > 0 ? "mt-1.5 pt-1.5 border-t border-zinc-800" : ""}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
            <span className="text-[9px] text-zinc-400 leading-none truncate">{line.label}</span>
          </div>
          <div className="flex items-baseline gap-1 pl-3">
            <span className="text-sm font-semibold text-white leading-none">{line.value}</span>
            {line.unit && (
              <span className="text-[9px] text-emerald-400 leading-none">{line.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

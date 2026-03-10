import type { Express } from "express";
import { createServer, type Server } from "http";
import { getCityBoundary } from "./services/osmService";
import { getRiversData } from "./services/riversService";
import { getSurfaceWaterData } from "./services/surfaceWaterService";
import { getForestCanopyData } from "./services/forestService";
import { getLandcoverData } from "./services/worldcoverService";
import { getBuildingData } from "./services/buildingService";
import { getPopulationData } from "./services/worldpopService";
import { getElevationData, computeElevationMetrics } from "./services/copernicusService";
import {
  generateGrid,
  computeRiverMetrics,
  computeWaterMetrics,
  computeLandcoverMetrics,
  computeBuildingMetrics,
  computePopulationMetrics,
  computeCompositeScores,
} from "./services/gridService";
import type { GeoBounds } from "@shared/schema";
import fs from "fs";
import path from "path";

const OEF_TILE_LAYERS: Record<string, string> = {
  dynamic_world:
    "https://geo-test-api.s3.us-east-1.amazonaws.com/nbs/porto_alegre/land_use/dynamic_world/V1/2023/tiles_visual/{z}/{x}/{y}.png",
};

function getSampleDataPath(filename: string): string {
  return path.resolve(process.cwd(), "client", "public", "sample-data", filename);
}

function saveSampleData(filename: string, data: any): void {
  const dirPath = path.resolve(process.cwd(), "client", "public", "sample-data");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(getSampleDataPath(filename), JSON.stringify(data));
}

function loadCachedData(filename: string): any | null {
  const filePath = getSampleDataPath(filename);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

function getBoundsFromBoundary(boundary: any): GeoBounds {
  return {
    minLat: boundary.bbox[0],
    minLng: boundary.bbox[1],
    maxLat: boundary.bbox[2],
    maxLng: boundary.bbox[3],
  };
}

function buildGrid(bounds: GeoBounds): any {
  const grid = generateGrid(bounds, 1);

  const rivers = loadCachedData("porto-alegre-rivers.json");
  if (rivers?.geoJson) computeRiverMetrics(grid, rivers.geoJson);

  const water = loadCachedData("porto-alegre-surface-water.json");
  if (water?.geoJson) computeWaterMetrics(grid, water.geoJson);

  const landcover = loadCachedData("porto-alegre-landcover.json");
  if (landcover?.geoJson) computeLandcoverMetrics(grid, landcover.geoJson);

  const buildings = loadCachedData("porto-alegre-buildings.json");
  if (buildings) computeBuildingMetrics(grid, buildings);

  const population = loadCachedData("porto-alegre-population.json");
  if (population) computePopulationMetrics(grid, population);

  const elevation = loadCachedData("porto-alegre-elevation.json");
  if (elevation) computeElevationMetrics(grid, elevation, bounds);

  computeCompositeScores(grid);

  return grid;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/geospatial/tiles/:layerId/:z/:x/:y.png", async (req, res) => {
    const { layerId, z, x, y } = req.params;

    if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
      return res.status(400).json({ message: "Invalid tile coordinates" });
    }

    const template = OEF_TILE_LAYERS[layerId];
    if (!template) {
      return res.status(404).json({ message: `Layer "${layerId}" not available` });
    }

    const tileUrl = template
      .replace("{z}", z)
      .replace("{x}", x)
      .replace("{y}", y);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const tileResponse = await fetch(tileUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!tileResponse.ok) {
        if (tileResponse.status === 404 || tileResponse.status === 403) {
          res.set("Cache-Control", "public, max-age=3600");
          return res.status(204).end();
        }
        return res
          .status(502)
          .json({ message: `Upstream error: ${tileResponse.status}` });
      }

      const buffer = Buffer.from(await tileResponse.arrayBuffer());
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      });
      res.send(buffer);
    } catch (error: any) {
      if (error.name === "AbortError") {
        return res.status(504).json({ message: "Tile request timed out" });
      }
      return res.status(502).json({ message: "Failed to fetch tile" });
    }
  });

  app.get("/api/geospatial/elevation", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-elevation.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getElevationData(bounds);
      saveSampleData("porto-alegre-elevation.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/boundary", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-boundary.json");
      if (cached) return res.json(cached);

      const data = await getCityBoundary("Porto Alegre", "BR-POA");
      saveSampleData("porto-alegre-boundary.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/rivers", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-rivers.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getRiversData("BR-POA", bounds);
      saveSampleData("porto-alegre-rivers.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/surface-water", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-surface-water.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getSurfaceWaterData("BR-POA", bounds);
      saveSampleData("porto-alegre-surface-water.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/forest", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-forest.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getForestCanopyData("BR-POA", bounds);
      saveSampleData("porto-alegre-forest.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/landcover", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-landcover.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getLandcoverData("BR-POA", bounds);
      saveSampleData("porto-alegre-landcover.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/buildings", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-buildings.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getBuildingData("BR-POA", bounds);
      saveSampleData("porto-alegre-buildings.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/population", async (_req, res) => {
    try {
      const cached = loadCachedData("porto-alegre-population.json");
      if (cached) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const data = await getPopulationData(bounds);
      saveSampleData("porto-alegre-population.json", data);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/geospatial/grid", async (_req, res) => {
    try {
      const hasBuildings = !!loadCachedData("porto-alegre-buildings.json");
      const hasElevation = !!loadCachedData("porto-alegre-elevation.json");
      const hasPopulation = !!loadCachedData("porto-alegre-population.json");
      const allDeps = hasBuildings && hasElevation && hasPopulation;

      const cached = loadCachedData("porto-alegre-grid.json");
      if (cached && allDeps) return res.json(cached);

      const boundary = loadCachedData("porto-alegre-boundary.json");
      if (!boundary) return res.status(400).json({ message: "Boundary not loaded yet" });

      const bounds = getBoundsFromBoundary(boundary);
      const grid = buildGrid(bounds);

      const data = {
        totalCells: grid.features.length,
        cellSizeMeters: 1000,
        geoJson: grid,
      };

      if (allDeps) {
        saveSampleData("porto-alegre-grid.json", data);
      }
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}

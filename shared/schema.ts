import { z } from "zod";

export type LayerType =
  | 'elevation'
  | 'landcover'
  | 'surface_water'
  | 'rivers'
  | 'forest_canopy'
  | 'population'
  | 'built_density';

export interface GeoBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface LayerMetadata {
  source: string;
  resolution: number;
  fetchedAt: string;
  processingTime?: number;
}

export interface LandcoverData {
  cityLocode: string;
  bounds: GeoBounds;
  classes: {
    builtUp: number;
    trees: number;
    shrubland: number;
    grassland: number;
    cropland: number;
    bareVegetation: number;
    water: number;
    wetland: number;
    mangroves: number;
    moss: number;
    snowIce: number;
  };
  geoJson?: any;
}

export interface BoundaryData {
  cityLocode: string;
  cityName: string;
  centroid: [number, number];
  bbox: [number, number, number, number];
  boundaryGeoJson: any;
}

export interface GridData {
  totalCells: number;
  cellSizeMeters: number;
  geoJson: any;
}

export interface ElevationData {
  elevationData: {
    width: number;
    height: number;
    cellSize: number;
    minElevation: number;
    maxElevation: number;
  };
  contours: any;
}

export interface RiversData {
  majorRivers: string[];
  totalLengthKm: number;
  geoJson: any;
}

export interface SurfaceWaterData {
  occurrence: {
    permanent: number;
    seasonal: number;
  };
  geoJson: any;
}

export interface ForestData {
  canopyCover: {
    mean: number;
    min: number;
    max: number;
  };
  geoJson: any;
}

export interface PopulationData {
  geoJson: any;
}

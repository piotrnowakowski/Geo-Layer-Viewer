export function getFloodColor(score: number): string {
  if (score >= 0.7) return '#1e40af';
  if (score >= 0.5) return '#3b82f6';
  if (score >= 0.3) return '#60a5fa';
  if (score >= 0.1) return '#93c5fd';
  return '#dbeafe';
}

export function getHeatColor(score: number): string {
  if (score >= 0.7) return '#991b1b';
  if (score >= 0.5) return '#dc2626';
  if (score >= 0.3) return '#f87171';
  if (score >= 0.1) return '#fca5a5';
  return '#fee2e2';
}

export function getLandslideColor(score: number): string {
  if (score >= 0.7) return '#78350f';
  if (score >= 0.5) return '#a16207';
  if (score >= 0.3) return '#ca8a04';
  if (score >= 0.1) return '#eab308';
  return '#fef3c7';
}

export function getPopulationColor(density: number): string {
  if (density >= 0.5) return '#5b21b6';
  if (density >= 0.3) return '#7c3aed';
  if (density >= 0.15) return '#8b5cf6';
  if (density >= 0.05) return '#a78bfa';
  if (density > 0) return '#c4b5fd';
  return '#ede9fe';
}

export function getBuildingColor(density: number): string {
  if (density >= 0.5) return '#9a3412';
  if (density >= 0.3) return '#c2410c';
  if (density >= 0.15) return '#ea580c';
  if (density >= 0.05) return '#f97316';
  if (density > 0) return '#fb923c';
  return '#ffedd5';
}

export const LANDCOVER_COLORS: Record<string, string> = {
  trees: '#228B22',
  builtUp: '#DC143C',
  grassland: '#98FB98',
  cropland: '#FFD700',
  water: '#1E90FF',
  bareVegetation: '#DEB887',
  shrubland: '#8B4513',
  wetland: '#2E8B57',
  mangroves: '#006400',
  moss: '#9ACD32',
  snowIce: '#F0F8FF',
};

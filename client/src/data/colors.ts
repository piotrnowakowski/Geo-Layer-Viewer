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

export function getSolarColor(pvout: number): string {
  if (pvout >= 4.2) return '#b45309';
  if (pvout >= 4.1) return '#d97706';
  if (pvout >= 4.0) return '#f59e0b';
  if (pvout >= 3.9) return '#fbbf24';
  if (pvout >= 3.8) return '#fcd34d';
  return '#fef3c7';
}

export function getPovertyColor(rate: number): string {
  if (rate >= 0.15) return '#581c87';
  if (rate >= 0.10) return '#7e22ce';
  if (rate >= 0.06) return '#a855f7';
  if (rate >= 0.03) return '#c084fc';
  if (rate > 0) return '#d8b4fe';
  return '#f3e8ff';
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

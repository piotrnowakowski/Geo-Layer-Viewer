export interface CurrencyAmount {
  currencyCode: string;
  amount: number;
}

export interface SolarCostBreakpoint {
  panelCount: number;
  installedCostPerPanel: number;
}

export interface SolarInvestmentModelConfig {
  currencyCode: string;
  referencePanelWatts: number;
  interpolation: "piecewise_linear";
  breakpoints: SolarCostBreakpoint[];
}

export interface EstimatedSolarInvestment {
  estimatedInstalledCostPerPanel: CurrencyAmount;
  estimatedInvestmentCost: CurrencyAmount;
}

export const DEFAULT_SOLAR_INVESTMENT_MODEL: SolarInvestmentModelConfig = {
  currencyCode: "BRL",
  referencePanelWatts: 400,
  interpolation: "piecewise_linear",
  breakpoints: [
    { panelCount: 20, installedCostPerPanel: 924 },
    { panelCount: 50, installedCostPerPanel: 860 },
    { panelCount: 100, installedCostPerPanel: 812 },
  ],
};

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function getSortedBreakpoints(
  config: SolarInvestmentModelConfig
): SolarCostBreakpoint[] {
  return [...config.breakpoints].sort((left, right) => left.panelCount - right.panelCount);
}

function interpolateInstalledCostPerPanel(
  panelCount: number,
  config: SolarInvestmentModelConfig
): number | null {
  if (!isFinitePositiveNumber(panelCount)) return null;

  const breakpoints = getSortedBreakpoints(config);
  if (breakpoints.length < 2) return null;

  let left = breakpoints[0];
  let right = breakpoints[1];

  if (panelCount <= breakpoints[0].panelCount) {
    left = breakpoints[0];
    right = breakpoints[1];
  } else if (panelCount >= breakpoints[breakpoints.length - 1].panelCount) {
    left = breakpoints[breakpoints.length - 2];
    right = breakpoints[breakpoints.length - 1];
  } else {
    for (let index = 1; index < breakpoints.length; index += 1) {
      if (panelCount <= breakpoints[index].panelCount) {
        left = breakpoints[index - 1];
        right = breakpoints[index];
        break;
      }
    }
  }

  const span = right.panelCount - left.panelCount;
  if (span <= 0) return null;

  const ratio = (panelCount - left.panelCount) / span;
  return left.installedCostPerPanel + ratio * (right.installedCostPerPanel - left.installedCostPerPanel);
}

export function estimateSolarInvestment(
  panelCount: number | null | undefined,
  panelCapacityWatts: number | null | undefined,
  config: SolarInvestmentModelConfig = DEFAULT_SOLAR_INVESTMENT_MODEL
): EstimatedSolarInvestment | null {
  if (!isFinitePositiveNumber(panelCount)) return null;

  const baseCostPerPanel = interpolateInstalledCostPerPanel(panelCount, config);
  if (!isFinitePositiveNumber(baseCostPerPanel)) return null;

  const effectivePanelWatts = isFinitePositiveNumber(panelCapacityWatts)
    ? panelCapacityWatts
    : config.referencePanelWatts;
  const wattageMultiplier = effectivePanelWatts / config.referencePanelWatts;
  const installedCostPerPanel = roundCurrency(baseCostPerPanel * wattageMultiplier);

  return {
    estimatedInstalledCostPerPanel: {
      currencyCode: config.currencyCode,
      amount: installedCostPerPanel,
    },
    estimatedInvestmentCost: {
      currencyCode: config.currencyCode,
      amount: roundCurrency(installedCostPerPanel * panelCount),
    },
  };
}

export function getSolarInvestmentModelMetadata(
  config: SolarInvestmentModelConfig = DEFAULT_SOLAR_INVESTMENT_MODEL
): SolarInvestmentModelConfig {
  return {
    currencyCode: config.currencyCode,
    referencePanelWatts: config.referencePanelWatts,
    interpolation: config.interpolation,
    breakpoints: getSortedBreakpoints(config),
  };
}

export const BRAZIL_GRID_EMISSIONS_FACTOR_KG_CO2E_PER_MWH = 59.9;
export const BRAZIL_GRID_EMISSIONS_BASE_YEAR = 2024;
export const BRAZIL_GRID_EMISSIONS_SOURCE_TITLE =
  "MME / EPE Balanço Energético Nacional 2025 (ano base 2024)";
export const BRAZIL_GRID_EMISSIONS_SOURCE_URL =
  "https://www.gov.br/mme/pt-br/assuntos/noticias/brasil-avanca-na-descarbonizacao-da-matriz-energetica";

/**
 * Screening carbon estimate for Brazilian rooftop-solar sites.
 *
 * Source: Brazil's Ministry of Mines and Energy (MME), citing EPE's BEN 2025
 * (base year 2024), reports an average electricity-generation emissions
 * intensity of 59.9 kg CO2 eq / MWh for Brazil in 2024.
 */
export function estimateBrazilSolarCarbonOffsetKgPerYear(
  annualGenerationKwh: number | null | undefined
): number | null {
  if (
    typeof annualGenerationKwh !== "number" ||
    !Number.isFinite(annualGenerationKwh) ||
    annualGenerationKwh <= 0
  ) {
    return null;
  }

  return (annualGenerationKwh / 1000) * BRAZIL_GRID_EMISSIONS_FACTOR_KG_CO2E_PER_MWH;
}

export function getBrazilSolarCarbonModelMetadata() {
  return {
    formula:
      `estimatedCarbonOffsetKgPerYear = maxYearlyEnergyDcKwh / 1000 * ` +
      `${BRAZIL_GRID_EMISSIONS_FACTOR_KG_CO2E_PER_MWH}`,
    generationField: "solarPotential.solarPanelConfigs[*].yearlyEnergyDcKwh (maximum panel layout)",
    outputUnit: "kg CO2e/year",
    gridEmissionFactorKgCo2ePerMwh: BRAZIL_GRID_EMISSIONS_FACTOR_KG_CO2E_PER_MWH,
    gridEmissionFactorBaseYear: BRAZIL_GRID_EMISSIONS_BASE_YEAR,
    source: BRAZIL_GRID_EMISSIONS_SOURCE_TITLE,
    sourceUrl: BRAZIL_GRID_EMISSIONS_SOURCE_URL,
  };
}

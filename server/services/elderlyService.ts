import path from "path";
import fs from "fs";

const SIDRA_BASE = "https://servicodados.ibge.gov.br/api/v3";
const POA_CODE = "4314902";

function getSampleDataPath(filename: string): string {
  return path.resolve(process.cwd(), "client", "public", "sample-data", filename);
}

function loadCached(filename: string): any | null {
  const p = getSampleDataPath(filename);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchSidra(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Sidra HTTP ${res.status}: ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface NeighbourhoodAgeData {
  code: string;
  name: string;
  pop_total: number;
  pop_65plus: number;
  pct_elderly: number;
}

async function fetchNeighbourhoodElderlyData(): Promise<NeighbourhoodAgeData[]> {
  const tables = [
    {
      table: "9605",
      label: "Censo 2022 - population by age group",
      ageClassification: "58",
      popVar: "93",
    },
    {
      table: "9514",
      label: "Censo 2022 - simple age",
      ageClassification: "2",
      popVar: "93",
    },
  ];

  for (const { table, label, ageClassification, popVar } of tables) {
    try {
      const url = `${SIDRA_BASE}/agregados/${table}/periodos/2022/variaveis/${popVar}?localidades=N6[${POA_CODE}]&classificacao=${ageClassification}[all]`;
      console.log(`[elderly] Trying SIDRA table ${table} (${label}): ${url}`);
      const raw = await fetchSidra(url);
      if (Array.isArray(raw) && raw.length > 0) {
        console.log(`[elderly] Table ${table} returned data`);
        return processTableData(raw);
      }
    } catch (e: any) {
      console.log(`[elderly] Table ${table} failed: ${e.message}`);
    }
  }
  return [];
}

function processTableData(raw: any[]): NeighbourhoodAgeData[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  try {
    const varData = raw[0];
    const resultados = varData?.resultados || [];

    const ageTotals: Record<string, Record<string, number>> = {};

    for (const result of resultados) {
      const classificacoes = result?.classificacoes || [];
      const series = result?.series || [];

      const ageCategory = classificacoes.find((c: any) => c.nome?.toLowerCase().includes("idade"));
      if (!ageCategory) continue;

      const ageLabel = Object.values(ageCategory?.categorias || {}).join("") as string;

      for (const s of series) {
        const localidade = s?.localidade?.nome || "Porto Alegre";
        const value = s?.serie?.["2022"] || s?.serie?.[Object.keys(s?.serie || {})[0]];
        if (!ageTotals[localidade]) ageTotals[localidade] = {};
        ageTotals[localidade][ageLabel] = Number(value) || 0;
      }
    }

    return Object.entries(ageTotals).map(([name, ages]) => {
      const total = Object.values(ages).reduce((a, b) => a + b, 0);
      const elderly = Object.entries(ages)
        .filter(([k]) => {
          const num = parseInt(k);
          return num >= 65 || k.includes("65") || k.includes("70") || k.includes("80") || k.includes("Mais");
        })
        .reduce((a, [, v]) => a + v, 0);
      return {
        code: name,
        name,
        pop_total: total,
        pop_65plus: elderly,
        pct_elderly: total > 0 ? elderly / total : 0,
      };
    });
  } catch (e: any) {
    console.log(`[elderly] processTableData error: ${e.message}`);
    return [];
  }
}

async function fetchMunicipalityAgeSummary(): Promise<{ pop_total: number; pop_65plus: number; pct_elderly: number } | null> {
  try {
    const url = `${SIDRA_BASE}/agregados/9514/periodos/2022/variaveis/93?localidades=N6[${POA_CODE}]`;
    const raw = await fetchSidra(url);
    console.log("[elderly] Municipality summary:", JSON.stringify(raw).slice(0, 300));

    const ageGroups: Record<string, number> = {};

    for (const varItem of (Array.isArray(raw) ? raw : [])) {
      const resultados = varItem?.resultados || [];
      for (const r of resultados) {
        const classificacoes = r?.classificacoes || [];
        const ageClass = classificacoes[0]?.categorias || {};
        const series = r?.series?.[0]?.serie || {};
        const value = Number(series?.["2022"] || 0);
        const ageCatId = Object.keys(ageClass)[0];
        const ageCatName = ageClass[ageCatId] || ageCatId;
        ageGroups[ageCatName] = (ageGroups[ageCatName] || 0) + value;
      }
    }

    const total = Object.values(ageGroups).reduce((a, b) => a + b, 0);
    const elderly = Object.entries(ageGroups)
      .filter(([k]) => {
        const n = parseInt(k);
        return n >= 65 || k.toLowerCase().includes("65") || k.toLowerCase().includes("70") || k.toLowerCase().includes("75") || k.toLowerCase().includes("80") || k.toLowerCase().includes("mais");
      })
      .reduce((a, [, v]) => a + v, 0);

    if (total > 0) return { pop_total: total, pop_65plus: elderly, pct_elderly: elderly / total };
  } catch (e: any) {
    console.log(`[elderly] Municipality summary failed: ${e.message}`);
  }
  return null;
}

export async function getElderlyPopulationData(): Promise<any> {
  const neighbourhoodGeoJson = loadCached("porto-alegre-ibge-indicators.json");
  if (!neighbourhoodGeoJson?.features?.length) {
    throw new Error("IBGE neighbourhood data not loaded — call /api/geospatial/ibge-indicators first");
  }

  const neighbourhoodData = await fetchNeighbourhoodElderlyData();
  const munSummary = await fetchMunicipalityAgeSummary();

  console.log(`[elderly] Neighbourhood rows: ${neighbourhoodData.length}, municipality summary:`, munSummary);

  if (neighbourhoodData.length === 0 && !munSummary) {
    throw new Error("IBGE Sidra API did not return age structure data for Porto Alegre");
  }

  const cityElderlyPct = munSummary?.pct_elderly || 0.15;
  console.log(`[elderly] City-wide elderly pct: ${(cityElderlyPct * 100).toFixed(1)}%`);

  const enrichedFeatures = (neighbourhoodGeoJson.features as any[]).map((feature: any) => {
    const p = feature.properties || {};
    const neighbourhoodName = p.neighbourhood_name || "";
    const matchedRow = neighbourhoodData.find(
      (r) => r.name.toLowerCase().includes(neighbourhoodName.toLowerCase()) ||
             neighbourhoodName.toLowerCase().includes(r.name.toLowerCase())
    );

    const pop_total = p.population_total || 0;

    let pop_65plus: number;
    let pct_elderly: number;
    let data_source: string;

    if (matchedRow && matchedRow.pct_elderly > 0) {
      pct_elderly = matchedRow.pct_elderly;
      pop_65plus = Math.round(pop_total * pct_elderly);
      data_source = "ibge_sidra_neighbourhood";
    } else {
      pct_elderly = cityElderlyPct + (Math.random() - 0.5) * 0 ;
      pop_65plus = Math.round(pop_total * pct_elderly);
      data_source = "ibge_sidra_city_estimate";
    }

    return {
      ...feature,
      properties: {
        ...p,
        pop_65plus,
        pct_elderly,
        data_source,
      },
    };
  });

  return {
    source: "ibge_sidra",
    city_elderly_pct: cityElderlyPct,
    featureCount: enrichedFeatures.length,
    geoJson: {
      type: "FeatureCollection",
      features: enrichedFeatures,
    },
  };
}

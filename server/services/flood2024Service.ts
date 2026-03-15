import type { GeoBounds } from "@shared/schema";

const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function tryCemsEmsr736(): Promise<any | null> {
  const wfsBase = "https://emergency.copernicus.eu/mapping/wfs";
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "EMSR736_AOI01_DEL_PRODUCT_r1_RTP01_v2",
    outputFormat: "application/json",
    count: "5000",
  });

  try {
    const res = await fetchWithTimeout(`${wfsBase}?${params}`);
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const data = await res.json();
        if (data?.features?.length > 0) {
          console.log(`[flood2024] CEMS WFS returned ${data.features.length} features`);
          return data;
        }
      }
    }
  } catch (e: any) {
    console.log(`[flood2024] CEMS WFS failed: ${e.message}`);
  }
  return null;
}

async function tryCemsRestApi(): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(
      "https://emergency.copernicus.eu/mapping/rest/products?activation_code=EMSR736&page=0&limit=50",
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const products = data?.products || data?.data || [];
    const delineationProduct = products.find(
      (p: any) =>
        p.type === "DEL" ||
        (p.name || "").toLowerCase().includes("delineation") ||
        (p.productType || "").toLowerCase().includes("delineation")
    );
    if (!delineationProduct) {
      console.log("[flood2024] CEMS REST: no delineation product found in", products.length, "results");
      return null;
    }
    const geoJsonUrl = delineationProduct.geojson_url || delineationProduct.download_url;
    if (!geoJsonUrl) return null;

    const geoRes = await fetchWithTimeout(geoJsonUrl);
    if (!geoRes.ok) return null;
    const geoData = await geoRes.json();
    if (geoData?.features?.length > 0) {
      console.log(`[flood2024] CEMS REST GeoJSON returned ${geoData.features.length} features`);
      return geoData;
    }
  } catch (e: any) {
    console.log(`[flood2024] CEMS REST failed: ${e.message}`);
  }
  return null;
}

async function tryCprmWfs(_bounds: GeoBounds): Promise<any | null> {
  const wfsBase = "https://geoportal.cprm.gov.br/geoserver/ows";
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    typeName: "cprm:area_inundacao_rs_2024",
    outputFormat: "application/json",
    maxFeatures: "5000",
  });

  try {
    const res = await fetchWithTimeout(`${wfsBase}?${params}`);
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const data = await res.json();
        if (data?.features?.length > 0) {
          console.log(`[flood2024] CPRM WFS returned ${data.features.length} features`);
          return data;
        }
      }
    }
  } catch (e: any) {
    console.log(`[flood2024] CPRM WFS failed: ${e.message}`);
  }
  return null;
}

async function tryAnaSnirh(_bounds: GeoBounds): Promise<any | null> {
  const wfsBase = "https://metadados.snirh.gov.br/geoserver/wfs";
  const layerNames = [
    "snirh:area_inundavel_rs_2024",
    "snirh:mancha_inundacao_rs_2024",
    "snirh:enchente_rs_2024",
  ];

  for (const typeName of layerNames) {
    const params = new URLSearchParams({
      service: "WFS",
      version: "1.0.0",
      request: "GetFeature",
      typeName,
      outputFormat: "application/json",
      maxFeatures: "5000",
    });
    try {
      const res = await fetchWithTimeout(`${wfsBase}?${params}`);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          const data = await res.json();
          if (data?.features?.length > 0) {
            console.log(`[flood2024] SNIRH WFS (${typeName}) returned ${data.features.length} features`);
            return data;
          }
        }
      }
    } catch (e: any) {
      console.log(`[flood2024] SNIRH ${typeName} failed: ${e.message}`);
    }
  }
  return null;
}

async function tryDefesaCivilRS(): Promise<any | null> {
  const urls = [
    "https://www.defesacivil.rs.gov.br/upload/arquivos/202405/area_inundacao_poa_2024.geojson",
    "https://geo.rs.gov.br/geoserver/wfs?service=WFS&request=GetFeature&typeName=sema:area_inundacao_2024&outputFormat=application/json",
    "https://geo.rs.gov.br/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=sema:inundacao_rs_maio2024&outputFormat=application/json",
  ];

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          const data = await res.json();
          if (data?.features?.length > 0) {
            console.log(`[flood2024] DefesaCivil RS returned ${data.features.length} features from ${url}`);
            return data;
          }
        }
      }
    } catch (e: any) {
      console.log(`[flood2024] DefesaCivil RS ${url} failed: ${e.message}`);
    }
  }
  return null;
}

export async function getFlood2024Data(bounds: GeoBounds): Promise<any> {
  console.log("[flood2024] Attempting to fetch 2024 Porto Alegre flood inundation data...");

  const attempts = [
    () => tryCemsEmsr736(),
    () => tryCemsRestApi(),
    () => tryCprmWfs(bounds),
    () => tryAnaSnirh(bounds),
    () => tryDefesaCivilRS(),
  ];

  for (const attempt of attempts) {
    const result = await attempt();
    if (result?.features?.length > 0) {
      return {
        source: "flood_2024",
        featureCount: result.features.length,
        geoJson: result,
      };
    }
  }

  throw new Error(
    "Could not retrieve 2024 flood inundation data from any available public source. " +
    "Sources tried: Copernicus EMSR736 WFS, CEMS REST API, CPRM GeoServer, ANA SNIRH WFS, Defesa Civil RS."
  );
}

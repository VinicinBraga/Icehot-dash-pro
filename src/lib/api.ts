// src/lib/api.ts
import type {
  KpiData,
  SeriesData,
  PieData,
  TableData,
  FilterOptions,
  Filters,
} from "./types";
import { getToken, clearToken } from "./auth";

// Base da API:
// - em produção: defina VITE_API_URL (ex: https://api.seudominio.com)
// - em dev: fallback para http://localhost:3001
const API_BASE_URL = (
  import.meta.env.VITE_API_URL?.toString() || "http://localhost:3001"
).replace(/\/+$/, "");

/** Adiciona filtros opcionais na URL */
function appendFilters(url: URL, f?: Filters) {
  if (!f) return;
  if (f.usuario !== undefined)
    url.searchParams.set("usuario", String(f.usuario));
  if (f.modelo !== undefined)
    url.searchParams.set("modelo", String(f.modelo));
  if (f.equipamento !== undefined)
    url.searchParams.set("equipamento", String(f.equipamento));
  if (f.serie) url.searchParams.set("serie", f.serie);
  if (f.status) url.searchParams.set("status", f.status);
}

/** Normaliza Date -> YYYY-MM-DD */
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Constrói URL final (aceita path relativo ou URL absoluta) */
function buildUrl(pathOrUrl: string): string {
  // se já for absoluta, retorna como está
  if (
    pathOrUrl.startsWith("http://") ||
    pathOrUrl.startsWith("https://")
  ) {
    return pathOrUrl;
  }

  // se for relativo, prefixa com base
  if (!pathOrUrl.startsWith("/")) {
    return `${API_BASE_URL}/${pathOrUrl}`;
  }

  return `${API_BASE_URL}${pathOrUrl}`;
}

/** Helper central: fetch com JWT + tratamento de 401 */
export async function apiFetch(
  pathOrUrl: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  const headers: HeadersInit = {
    ...(options.headers || {}),
  };

  // Só define Content-Type se tiver body e não tiver sido definido
  if (
    options.body &&
    !(headers["Content-Type"] || headers["content-type"])
  ) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(pathOrUrl), {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Token inválido/expirado → limpa e volta pro login
    clearToken();
    window.location.href = "/";
  }

  return res;
}

// =======================
// Funções específicas de API
// =======================

export async function fetchKpis(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<KpiData> {
  const url = new URL("/api/kpis", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await apiFetch(url.toString());
  if (!res.ok) throw new Error(`Falha ao buscar KPIs (${res.status})`);
  return (await res.json()) as KpiData;
}

export async function fetchWaterSeries(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<SeriesData> {
  const url = new URL("/api/series/water", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await apiFetch(url.toString());
  if (!res.ok)
    throw new Error(`Falha ao buscar séries de água (${res.status})`);
  return (await res.json()) as SeriesData;
}

export async function fetchTriggerSeries(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<SeriesData> {
  const url = new URL("/api/series/triggers", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await apiFetch(url.toString());
  if (!res.ok)
    throw new Error(
      `Falha ao buscar séries de acionamentos (${res.status})`
    );
  return (await res.json()) as SeriesData;
}

export async function fetchModelPie(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<PieData[]> {
  const url = new URL("/api/models/pie", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await apiFetch(url.toString());
  if (!res.ok)
    throw new Error(
      `Falha ao buscar distribuição de modelos (${res.status})`
    );
  return (await res.json()) as PieData[];
}

export async function fetchWaterByEquipment(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<TableData> {
  const url = new URL(
    "/api/tables/water-by-equipment",
    API_BASE_URL
  );
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await apiFetch(url.toString());
  if (!res.ok)
    throw new Error(
      `Falha ao buscar tabela de água (${res.status})`
    );
  return (await res.json()) as TableData;
}

export async function fetchTriggerTable(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<TableData> {
  const url = new URL(
    "/api/tables/triggers-by-equipment",
    API_BASE_URL
  );
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await apiFetch(url.toString());
  if (!res.ok)
    throw new Error(
      `Falha ao buscar tabela de acionamentos (${res.status})`
    );
  return (await res.json()) as TableData;
}

export async function fetchFilters(): Promise<FilterOptions> {
  const url = new URL("/api/filters", API_BASE_URL);
  const res = await apiFetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Falha ao buscar filtros (${res.status}): ${
        text || res.statusText
      }`
    );
  }
  return (await res.json()) as FilterOptions;
}

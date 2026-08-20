// src/lib/api.ts

import type {
  KpiData,
  SeriesData,
  PieData,
  TableData,
  FilterOptions,
  Filters,
  MapPoint,
} from "./types";

import { getToken, clearToken } from "./auth"; // ← usa o token real do login

/** ========= Base da API ========= **/
const API_BASE_URL = (import.meta.env.DEV
  ? "http://localhost:3001"
  : import.meta.env.VITE_API_URL?.toString() || "http://localhost:3001"
).replace(/\/+$/, "");

/** ========= Utils ========= **/
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function appendFilters(url: URL, f?: Filters) {
  if (!f) return;

  if (f.usuario !== undefined && f.usuario !== null) {
    url.searchParams.set("usuario", String(f.usuario));
  }

  if (f.modelo !== undefined && f.modelo !== null) {
    url.searchParams.set("modelo", String(f.modelo));
  }

  if (f.equipamentos?.length) {
    url.searchParams.set("equipamentos", f.equipamentos.join(","));
  }

  if (f.serie) {
    url.searchParams.set("serie", f.serie);
  }

  // 👇 Aqui garantimos que o status 0 não seja "ignorado"
  if (f.status !== undefined && f.status !== null && f.status !== "") {
    url.searchParams.set("status", String(f.status));
  }
}

function buildUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  if (!pathOrUrl.startsWith("/")) return `${API_BASE_URL}/${pathOrUrl}`;
  return `${API_BASE_URL}${pathOrUrl}`;
}

/** ========= Fetch central com JWT ========= **/
export async function apiFetch(
  pathOrUrl: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  // ✅ Sempre trabalha com Headers (não com HeadersInit misto)
  const headers = new Headers(options.headers || undefined);

  // Define Content-Type se tiver body e ainda não estiver definido
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // 🔑 Sempre seta Authorization quando tiver token
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(buildUrl(pathOrUrl), {
    ...options,
    headers,
    credentials: "omit",
  });

  if (res.status === 401) {
    clearToken();
    if (
      typeof window !== "undefined" &&
      !location.pathname.startsWith("/login")
    ) {
      window.location.href = "/";
    }
  }

  return res;
}


/** ========= Helpers JSON ========= **/
async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${label} (${res.status}): ${txt || res.statusText}`);
  }
  return (await res.json()) as T;
}



/** ========= ENDPOINTS ESPECÍFICOS ========= **/

// KPIs principais
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
  return jsonOrThrow<KpiData>(res, "Falha ao buscar KPIs");
}

// Séries de litros
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
  return jsonOrThrow<SeriesData>(res, "Falha ao buscar séries de água");
}

// Séries de acionamentos
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
  return jsonOrThrow<SeriesData>(res, "Falha ao buscar séries de acionamentos");
}

// Pizza por modelo
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
  return jsonOrThrow<PieData[]>(res, "Falha ao buscar distribuição de modelos");
}

// Tabela litros x equipamento
export async function fetchWaterByEquipment(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<TableData> {
  const url = new URL("/api/tables/water-by-equipment", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);
  const res = await apiFetch(url.toString());
  return jsonOrThrow<TableData>(res, "Falha ao buscar tabela de água");
}

// Tabela acionamentos x equipamento
export async function fetchTriggerTable(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<TableData> {
  const url = new URL("/api/tables/triggers-by-equipment", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);
  const res = await apiFetch(url.toString());
  return jsonOrThrow<TableData>(res, "Falha ao buscar tabela de acionamentos");
}

// Tabela temperatura água quente (atual)
export async function fetchHotTemperatureTable(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<{
  hot: TableData & { hidden?: boolean };
  cold: TableData & { hidden?: boolean };
}> {
  const url = new URL("/api/tables/hot-temperature", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await apiFetch(url.toString());
  return jsonOrThrow(res, "Falha ao buscar tabela de temperatura");
}

export type TemperatureHistoryEquipment = {
  maquina_id: number;
  maquina_nome: string;
  labels: string[];
  series: Array<{
    key: "quente" | "fria";
    values: Array<number | null>;
  }>;
  rows: Array<{
    maquina_id: number;
    maquina_nome: string;
    leitura_em: string;
    temperatura_quente: number | null;
    temperatura_fria: number | null;
    leituras: number;
  }>;
};

export type TemperatureHistoryResponse = {
  equipments: TemperatureHistoryEquipment[];
  total: number;
  total_equipments: number;
  _period?: {
    from: string;
    to: string;
    email: string;
  };
};

export async function fetchTemperatureHistory(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<TemperatureHistoryResponse> {
  const url = new URL("/api/series/temperature-history", API_BASE_URL);

  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  url.searchParams.set("_t", String(Date.now()));

  appendFilters(url, filters);

  const res = await apiFetch(url.toString());

  return jsonOrThrow<TemperatureHistoryResponse>(
    res,
    "Falha ao buscar histórico de temperatura"
  );
}

// Filtros (usuarios, modelos, equipamentos, séries, status)
export async function fetchFilters(): Promise<FilterOptions> {
  const url = new URL("/api/filters", API_BASE_URL);
  const res = await apiFetch(url.toString());
  return jsonOrThrow<FilterOptions>(res, "Falha ao buscar filtros");
}

/** ====== Localização / Equipamentos (seu backend já expõe) ====== */

// Pontos para o mapa
export async function fetchLocationPoints(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<{ points: MapPoint[] }> {
  const url = new URL("/api/localizacao", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);
  const res = await apiFetch(url.toString());
  return jsonOrThrow(res, "Falha ao buscar pontos de localização");
}

// KPIs de equipamentos (aba Localização/Equipamentos)
export async function fetchEquipmentKpis(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<{ total_equipamentos: number; ativos: number; inativos: number }> {
  const url = new URL("/api/kpis/equipment", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);
  const res = await apiFetch(url.toString());
  return jsonOrThrow(res, "Falha ao buscar KPIs de equipamentos");
}

// KPIs de localização (usuarios_total, ativos, inativos)
export async function fetchLocationKpis(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<{
  users_total: number;
  equipamentos_ativos: number;
  equipamentos_inativos: number;
}> {
  const url = new URL("/api/location/kpis", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);
  const res = await apiFetch(url.toString());
  return jsonOrThrow(res, "Falha ao buscar KPIs de localização");
}

// Resumo por cidade/UF
export async function fetchLocationSummary(
  from: Date,
  to: Date,
  filters?: Filters
): Promise<TableData> {
  const url = new URL("/api/location/summary", API_BASE_URL);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);
  const res = await apiFetch(url.toString());
  return jsonOrThrow<TableData>(res, "Falha ao buscar resumo de localização");
}

/** ========= Auth / Health ========= **/

type LoginResponse = {
  token: string;
  user: { id: number; email: string; isMaster?: boolean };
};

export async function login(email: string, password: string) {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const data = await jsonOrThrow<LoginResponse>(res, "Falha no login");

  // 🔑 SALVAR TOKEN AQUI
  if (data.token) {
    localStorage.setItem("icehot_auth_token", data.token);
  }

  return data;
}


export function logout() {
  clearToken();
}

export async function me() {
  const res = await apiFetch("/api/auth/me");
  return jsonOrThrow(res, "Falha ao consultar /me");
}

export async function health() {
  const res = await apiFetch("/api/health");
  return jsonOrThrow(res, "Falha no /health");
}

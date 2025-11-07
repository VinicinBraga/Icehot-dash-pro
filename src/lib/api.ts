// src/lib/api.ts
import type {
  KpiData,
  SeriesData,
  PieData,
  TableData,
  FilterOptions,
  Filters,
} from "./types";

const API_URL =
  import.meta.env.VITE_API_URL?.toString() || "http://localhost:3001";
const DEFAULT_EMAIL =
  import.meta.env.VITE_USER_EMAIL?.toString() || "teste@icehot.com.br";

/** Adiciona filtros opcionais na URL */
function appendFilters(url: URL, f?: Filters) {
  if (!f) return;
  if (f.usuario !== undefined) url.searchParams.set("usuario", String(f.usuario));
  if (f.modelo !== undefined) url.searchParams.set("modelo", String(f.modelo));
  if (f.equipamento !== undefined) url.searchParams.set("equipamento", String(f.equipamento));
  if (f.serie) url.searchParams.set("serie", f.serie);
  if (f.status) url.searchParams.set("status", f.status);
}

/** Normaliza Date -> YYYY-MM-DD (sem timezone) */
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchKpis(
  from: Date,
  to: Date,
  filters?: Filters,
  userEmail = DEFAULT_EMAIL
): Promise<KpiData> {
  const url = new URL(`${API_URL}/api/kpis`);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await fetch(url.toString(), {
    headers: { "x-user-email": userEmail },
  });
  if (!res.ok) throw new Error(`Falha ao buscar KPIs (${res.status})`);
  return (await res.json()) as KpiData;
}

export async function fetchWaterSeries(
  from: Date,
  to: Date,
  filters?: Filters,
  userEmail = DEFAULT_EMAIL
): Promise<SeriesData> {
  const url = new URL(`${API_URL}/api/series/water`);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await fetch(url.toString(), {
    headers: { "x-user-email": userEmail },
  });
  if (!res.ok)
    throw new Error(`Falha ao buscar séries de água (${res.status})`);
  return (await res.json()) as SeriesData;
}

export async function fetchTriggerSeries(
  from: Date,
  to: Date,
  filters?: Filters,
  userEmail = DEFAULT_EMAIL
): Promise<SeriesData> {
  const url = new URL(`${API_URL}/api/series/triggers`);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await fetch(url.toString(), {
    headers: { "x-user-email": userEmail },
  });
  if (!res.ok)
    throw new Error(
      `Falha ao buscar séries de acionamentos (${res.status})`
    );
  return (await res.json()) as SeriesData;
}

export async function fetchModelPie(
  from: Date,
  to: Date,
  filters?: Filters,
  userEmail = DEFAULT_EMAIL
): Promise<PieData[]> {
  const url = new URL(`${API_URL}/api/models/pie`);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);
  const res = await fetch(url.toString(), {
    headers: { "x-user-email": userEmail },
  });
  if (!res.ok) {
    throw new Error(
      `Falha ao buscar distribuição de modelos (${res.status})`
    );
  }
  return (await res.json()) as PieData[];
}

export async function fetchWaterByEquipment(
  from: Date,
  to: Date,
  filters?: Filters,
  userEmail = DEFAULT_EMAIL
): Promise<TableData> {
  const url = new URL(`${API_URL}/api/tables/water-by-equipment`);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await fetch(url.toString(), {
    headers: { "x-user-email": userEmail },
  });
  if (!res.ok)
    throw new Error(`Falha ao buscar tabela de água (${res.status})`);
  return (await res.json()) as TableData;
}

export async function fetchTriggerTable(
  from: Date,
  to: Date,
  filters?: Filters,
  userEmail = DEFAULT_EMAIL
): Promise<TableData> {
  const url = new URL(`${API_URL}/api/tables/triggers-by-equipment`);
  url.searchParams.set("from", toYMD(from));
  url.searchParams.set("to", toYMD(to));
  appendFilters(url, filters);

  const res = await fetch(url.toString(), {
    headers: { "x-user-email": userEmail },
  });
  if (!res.ok)
    throw new Error(
      `Falha ao buscar tabela de acionamentos (${res.status})`
    );
  return (await res.json()) as TableData;
}

export async function fetchFilters(
  userEmail = DEFAULT_EMAIL
): Promise<FilterOptions> {
  const url = new URL(`${API_URL}/api/filters`);
  const res = await fetch(url.toString(), {
    headers: { "x-user-email": userEmail },
  });
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

// src/lib/types.ts

// === KPIs ===
export interface KpiData {
  water: {
    total: number;
    fria: number;
    quente: number;
    pets: number;
  };
  triggers: {
    total: number;
    fria: number;
    quente: number;
    pets: number;
    aspersor: number;
  };
  equipamentos_utilizados: number;
  garrafas_poupadas: number;
  co2_poupado_kg: number;
  modules: {
    fria: boolean;
    quente: boolean;
    pets: boolean;
    aspersor: boolean;
  };

  _period?: { from: string; to: string; email: string };
  
}

// === Séries (recharts) ===
export interface SeriesData {
  labels: string[];
  series: Array<{
    key: string;
    values: number[];
  }>;
  _period?: { from: string; to: string; email: string };
}

// === Pizza (modelos) ===
export interface PieData {
  label: string;
  value: number;
}

// === Tabelas reutilizáveis ===
export interface TableData {
  columns: string[];
  rows: Array<Array<string | number>>;
  total: number;
  _period?: { from: string; to: string; email: string };
}

// === Mapa (se precisar mais à frente) ===
export interface MapPoint {
  lat: number;
  lng: number;
  cidade: string;
  uf: string;
  qtd: number;
  status: string;
  litros: number;
}

// === Filtros ===
// item de usuário tem email junto
export interface FilterUser {
  value: number;    // id do usuário
  label: string;    // name do usuário
  email: string;
}

// itens genéricos (modelo, equipamento)
export interface FilterItem {
  value: number | string;
  label: string;
}

export interface FilterOptions {
  usuarios: FilterUser[];
  modelos: FilterItem[];       // value = tipos.id, label = tipos.nome
  equipamentos: FilterItem[];  // value = maquinas.id, label = maquinas.nome (ou EQP-{id})
  series: Array<{ value: string; label: string }>; // numeroSerieEquipamento / serialNumber
  status: Array<{ value: string; label: string }>; // "Ativo" | "Inativo"
  _email?: string; // devolvido pelo backend só p/ debug
}

export interface Filters {
  usuario?: number;
  modelo?: number;
  equipamento?: number;
  serie?: string;
  status?: string;
}

// === Date range (usado pelos hooks e API) ===
export interface DateRange {
  from: Date;
  to: Date;
}

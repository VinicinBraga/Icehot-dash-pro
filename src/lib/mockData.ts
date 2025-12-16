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
}

export interface SeriesData {
  labels: string[];
  series: Array<{
    key: string;
    values: number[];
  }>;
}

export interface PieData {
  label: string;
  value: number;
}

export interface TableData {
  columns: string[];
  rows: Array<Array<string | number>>;
  total: number;
}

export interface MapPoint {
  lat: number;
  lng: number;
  cidade: string;
  uf: string;
  qtd: number;
  status: string;
  litros: number;
}

export interface FilterOptions {
  usuarios: Array<{ value: number; label: string; email: string }>;
  modelos: Array<{ value: number; label: string }>;
  equipamentos: Array<{ value: number; label: string }>;
  series: Array<{ value: string; label: string }>;
  status: Array<{ value: string; label: string }>;
}

export const mockKpis: KpiData = {
  water: {
    total: 0,
    fria: 0,
    quente: 0,
    pets: 0,
  },
  triggers: {
    total: 0,
    fria: 0,
    quente: 0,
    pets: 0,
    aspersor: 0,
  },
  equipamentos_utilizados: 0,
  garrafas_poupadas: 0,
  co2_poupado_kg: 0,
};

export const mockWaterSeries: SeriesData = {
  labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  series: [
    { key: 'total', values: [0] },
    { key: 'fria', values: [0]  },
    { key: 'quente', values: [0] },
    { key: 'pets', values: [0]  },
  ],
};

export const mockTriggerSeries: SeriesData = {
  labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  series: [
    { key: 'total', values: [0] },
    { key: 'fria', values: [0] },
    { key: 'quente', values: [0] },
    { key: 'pets', values: [0] },
    { key: 'aspersor', values: [0] },
  ],
};

export const mockPieData: PieData[] = [
  { label: '1', value: 0 },
  { label: '2', value: 0 },
];

export const mockTableWater: TableData = {
  columns: ['Equipamento', 'Litros'],
  rows: [
    ['1', 0],
    ['2', 0],
    ['3', 0],
  ],
  total: 0,
};

export const mockTableUsage: TableData = {
  columns: ['Equipamento', 'Acionamentos'],
  rows: [
    ['1', 0],
    ['2', 0],
    ['3', 0],
  ],
  total: 398,
};

export const mockEquipmentTable: TableData = {
  columns: ['#', 'Equipamento', 'Usuário', 'Nº de Série', 'Localização', 'Status', 'Troca de Filtro', 'Previsão'],
  rows: [
    [1, 'Carregando...', 'Carregando...', 'Carregando...', 'Carregando...', 'Carregando...', 'Carregando...', 'Carregando...'],
  ],
  total: 398,
};

export const mockInstallationSeries: SeriesData = {
  labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  series: [
    { key: 'instalacoes', values: [12, 15, 8, 18, 22, 14] },
  ],
};

export const mockCumulativeSeries: SeriesData = {
  labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  series: [
    { key: 'acumulado', values: [320, 335, 343, 361, 383, 397] },
  ],
};

export const mockMapPoints: MapPoint[] = [
  { lat: -27.5954, lng: -48.5480, cidade: 'Florianópolis', uf: 'SC', qtd: 24, status: 'Ativo', litros: 12340000 },
  { lat: -23.5505, lng: -46.6333, cidade: 'São Paulo', uf: 'SP', qtd: 89, status: 'Ativo', litros: 45600000 },
  { lat: -22.9068, lng: -43.1729, cidade: 'Rio de Janeiro', uf: 'RJ', qtd: 67, status: 'Ativo', litros: 34200000 },
  { lat: -25.4284, lng: -49.2733, cidade: 'Curitiba', uf: 'PR', qtd: 43, status: 'Ativo', litros: 21800000 },
  { lat: -30.0346, lng: -51.2177, cidade: 'Porto Alegre', uf: 'RS', qtd: 38, status: 'Ativo', litros: 19500000 },
  { lat: -19.9167, lng: -43.9345, cidade: 'Belo Horizonte', uf: 'MG', qtd: 52, status: 'Ativo', litros: 26700000 },
  { lat: -15.7801, lng: -47.9292, cidade: 'Brasília', uf: 'DF', qtd: 31, status: 'Ativo', litros: 15900000 },
  { lat: -12.9714, lng: -38.5014, cidade: 'Salvador', uf: 'BA', qtd: 28, status: 'Ativo', litros: 14300000 },
];

export const mockLocationTable: TableData = {
  columns: ['#', 'Cidade', 'Estado', 'UF', 'Qtd Equipamentos'],
  rows: [
    [1, 'São Paulo', 'São Paulo', 'SP', 89],
    [2, 'Rio de Janeiro', 'Rio de Janeiro', 'RJ', 67],
    [3, 'Belo Horizonte', 'Minas Gerais', 'MG', 52],
    [4, 'Curitiba', 'Paraná', 'PR', 43],
    [5, 'Porto Alegre', 'Rio Grande do Sul', 'RS', 38],
    [6, 'Brasília', 'Distrito Federal', 'DF', 31],
    [7, 'Salvador', 'Bahia', 'BA', 28],
    [8, 'Florianópolis', 'Santa Catarina', 'SC', 24],
  ],
  total: 398,
};

export const mockFilterOptions: FilterOptions = {
  usuarios: [
    { value: 1, label: 'Vazio', email: '' },
 
  ],
  modelos: [
    { value: 1, label: 'Vazio' },
  ],
  equipamentos: [
    { value: 21, label: 'Vazio' },

  ],
  series: [
    { value: '', label: '' },

  ],
  status: [
    { value: 'Ativo', label: 'Ativo' },
    { value: 'Inativo', label: 'Inativo' },
  ],
};

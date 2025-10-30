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
  co2_poupado_m3: number;
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
    total: 289020000,
    fria: 124740000,
    quente: 5440000,
    pets: 158840000,
  },
  triggers: {
    total: 6000000000,
    fria: 5000000000,
    quente: 193000000,
    pets: 621000000,
    aspersor: 520000000,
  },
  equipamentos_utilizados: 398,
  garrafas_poupadas: 578000000,
  co2_poupado_m3: 14700000,
};

export const mockWaterSeries: SeriesData = {
  labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  series: [
    { key: 'total', values: [48000000, 52000000, 45000000, 49000000, 47000000, 48000000] },
    { key: 'fria', values: [21000000, 22000000, 19000000, 21000000, 20000000, 21000000] },
    { key: 'quente', values: [900000, 950000, 850000, 920000, 880000, 940000] },
    { key: 'pets', values: [26000000, 29000000, 25000000, 27000000, 26000000, 26000000] },
  ],
};

export const mockTriggerSeries: SeriesData = {
  labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
  series: [
    { key: 'total', values: [1000000000, 1050000000, 980000000, 1020000000, 990000000, 960000000] },
    { key: 'fria', values: [830000000, 870000000, 815000000, 850000000, 825000000, 810000000] },
    { key: 'quente', values: [32000000, 33000000, 31000000, 33000000, 32000000, 32000000] },
    { key: 'pets', values: [103000000, 106000000, 100000000, 104000000, 101000000, 102000000] },
    { key: 'aspersor', values: [35000000, 41000000, 34000000, 33000000, 32000000, 16000000] },
  ],
};

export const mockPieData: PieData[] = [
  { label: 'Slim', value: 245 },
  { label: 'Pro', value: 153 },
];

export const mockTableWater: TableData = {
  columns: ['Equipamento', 'Litros'],
  rows: [
    ['Parque Central | EQP-21', 117225069.8],
    ['Shopping Norte | EQP-45', 98450123.5],
    ['Av. Principal | EQP-12', 73815642.2],
  ],
  total: 398,
};

export const mockTableUsage: TableData = {
  columns: ['Equipamento', 'Acionamentos'],
  rows: [
    ['Parque Central | EQP-21', 428823984],
    ['Shopping Norte | EQP-45', 385612450],
    ['Av. Principal | EQP-12', 297451203],
  ],
  total: 398,
};

export const mockEquipmentTable: TableData = {
  columns: ['#', 'Equipamento', 'Usuário', 'Nº de Série', 'Localização', 'Status', 'Troca de Filtro', 'Previsão'],
  rows: [
    [1, 'EQP-21', 'Maria Silva', 'SN-1234', 'Florianópolis - SC', 'Ativo', '45 dias', 'Em Dia'],
    [2, 'EQP-45', 'João Santos', 'SN-5678', 'São Paulo - SP', 'Ativo', '12 dias', 'Em Dia'],
    [3, 'EQP-12', 'Ana Costa', 'SN-9012', 'Rio de Janeiro - RJ', 'Inativo', '120 dias', 'Atraso'],
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
    { value: 1, label: 'Maria Silva', email: 'maria@icehot.com' },
    { value: 2, label: 'João Santos', email: 'joao@icehot.com' },
    { value: 3, label: 'Ana Costa', email: 'ana@icehot.com' },
  ],
  modelos: [
    { value: 1, label: 'Slim' },
    { value: 2, label: 'Pro' },
  ],
  equipamentos: [
    { value: 21, label: 'EQP-21' },
    { value: 45, label: 'EQP-45' },
    { value: 12, label: 'EQP-12' },
  ],
  series: [
    { value: 'SN-1234', label: 'SN-1234' },
    { value: 'SN-5678', label: 'SN-5678' },
    { value: 'SN-9012', label: 'SN-9012' },
  ],
  status: [
    { value: 'Ativo', label: 'Ativo' },
    { value: 'Inativo', label: 'Inativo' },
  ],
};

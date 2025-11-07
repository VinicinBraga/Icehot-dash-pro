export function formatNumber(
  value: number,
  opts?: { decimals?: number }
) {
  const { decimals = 2 } = opts || {};
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export const formatLiters = (n?: number) =>
  `${formatNumber(n ?? 0, { decimals: 2 })}`;

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).replace(',', '.');
  const num = Number(str);
  return isNaN(num) ? 0 : num;
}


export const formatClicks = (n?: number) =>
  `${formatNumber(n ?? 0, { decimals: 0 })}`;

  export const formatBottles = (n?: number) =>
  `${formatNumber(n ?? 0, { decimals: 2 })}`;

  export const formatCO2 = (n?: number) =>
  `${formatNumber(n ?? 0, { decimals: 2 })}`;

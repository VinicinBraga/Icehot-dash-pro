export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}bi`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}mi`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString('pt-BR');
}

export function formatLiters(value: number): string {
  return formatNumber(value);
}

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

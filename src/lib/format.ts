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

export function formatLiters(value: number | null | undefined): string {
  const n = Number(value || 0);
  const abs = Math.abs(n);

  // Até 99.999,99 → número "normal"
  if (abs < 100_000) {
    return formatNumber(n, { decimals: 2 });
  }

  // De 100.000 até 999.999,99 → em "mil"
  if (abs < 1_000_000) {
    const thousands = n / 1_000;
    // 1 casa decimal se < 100 mil, senão 0 casas
    const decimals = Math.abs(thousands) < 100 ? 1 : 0;
    return `${formatNumber(thousands, { decimals })} mil `;
  }

  // 1.000.000+ → em "mi"
  const millions = n / 1_000_000;
  const decimals = Math.abs(millions) < 100 ? 1 : 0;
  return `${formatNumber(millions, { decimals })} mi `;
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


export function formatClicks(value?: number): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);

  // Até 99.999 → normal
  if (abs < 100_000) {
    return formatNumber(n, { decimals: 0 });
  }

  // 100.000 a 999.999 → em mil
  if (abs < 1_000_000) {
    const thousands = n / 1_000;
    const decimals = Math.abs(thousands) < 100 ? 1 : 0;
    return `${formatNumber(thousands, { decimals })} mil `;
  }

  // 1 milhão+
  const millions = n / 1_000_000;
  const decimals = Math.abs(millions) < 100 ? 1 : 0;
  return `${formatNumber(millions, { decimals })} mi `;
}

export function formatBottles(value?: number): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);

  // Até 99.999 → normal com duas casas
  if (abs < 100_000) {
    return formatNumber(n, { decimals: 2 });
  }

  // 100.000 a 999.999 → em mil
  if (abs < 1_000_000) {
    const thousands = n / 1_000;
    const decimals = Math.abs(thousands) < 100 ? 1 : 0;
    return `${formatNumber(thousands, { decimals })} mil `;
  }

  // 1 milhão+
  const millions = n / 1_000_000;
  const decimals = Math.abs(millions) < 100 ? 1 : 0;
  return `${formatNumber(millions, { decimals })} mi `;
}

export function formatCO2(value?: number): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);

  // Até 99.999 → normal
  if (abs < 100_000) {
    return formatNumber(n, { decimals: 2 });
  }

  // 100.000 a 999.999 → em mil
  if (abs < 1_000_000) {
    const thousands = n / 1_000;
    const decimals = Math.abs(thousands) < 100 ? 1 : 0;
    return `${formatNumber(thousands, { decimals })} mil `;
  }

  // 1 milhão+
  const millions = n / 1_000_000;
  const decimals = Math.abs(millions) < 100 ? 1 : 0;
  return `${formatNumber(millions, { decimals })} mi `;
}

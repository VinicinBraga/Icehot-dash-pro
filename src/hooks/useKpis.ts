// src/hooks/useKpis.ts
import { useEffect, useState } from "react";
import { fetchKpis } from "@/lib/api";
import type { KpiData, Filters } from "@/lib/types";

type DateRange = { from: Date; to: Date };

export function useKpis(range: DateRange, filters?: Filters) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchKpis(range.from, range.to, filters)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // re-fetch quando filtros mudarem
  }, [range.from, range.to, JSON.stringify(filters)]);

  return { data, loading, error };
}

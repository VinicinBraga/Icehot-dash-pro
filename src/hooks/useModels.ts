// src/hooks/useModels.ts
import { useEffect, useState } from "react";
import { fetchModelPie } from "@/lib/api";
import type { PieData, Filters } from "@/lib/types";

export interface DateRange {
  from: Date;
  to: Date;
}

export function useModelPie(range: DateRange, filters: Filters) {
  const [data, setData] = useState<PieData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchModelPie(range.from, range.to, filters)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    range.from,
    range.to,
    filters.usuario,
    filters.modelo,
    filters.equipamentos,
    filters.serie,
    filters.status,
  ]);

  return { data, loading, error };
}

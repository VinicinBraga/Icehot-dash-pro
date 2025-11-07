// src/hooks/useTriggerTable.ts
import { useEffect, useState } from "react";
import { fetchTriggerTable } from "@/lib/api";
import type { TableData, Filters } from "@/lib/types";

type DateRange = { from: Date; to: Date };

export function useTriggerTable(range: DateRange, filters?: Filters) {
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTriggerTable(range.from, range.to, filters)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, JSON.stringify(filters)]);

  return { data, loading, error };
}

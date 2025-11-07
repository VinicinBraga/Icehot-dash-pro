// src/hooks/useSeries.ts
import { useEffect, useState } from "react";
import { fetchWaterSeries, fetchTriggerSeries } from "@/lib/api";
import type { SeriesData, Filters } from "@/lib/types";

type DateRange = { from: Date; to: Date };

export function useWaterSeries(range: DateRange, filters?: Filters) {
  const [data, setData] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWaterSeries(range.from, range.to, filters)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, JSON.stringify(filters)]);

  return { data, loading, error };
}

export function useTriggerSeries(range: DateRange, filters?: Filters) {
  const [data, setData] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTriggerSeries(range.from, range.to, filters)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, JSON.stringify(filters)]);

  return { data, loading, error };
}

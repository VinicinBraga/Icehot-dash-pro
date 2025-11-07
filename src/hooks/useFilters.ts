// src/hooks/useFilters.ts
import { useEffect, useState } from "react";
import { fetchFilters } from "@/lib/api";
import type { FilterOptions } from "@/lib/types";

export function useFilters() {
  const [data, setData] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFilters()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

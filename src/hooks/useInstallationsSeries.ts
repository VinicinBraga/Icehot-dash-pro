import { useEffect, useState } from "react";
import type { Filters } from "@/lib/types";

interface SeriesData {
  labels: string[];
  series: Array<{ key: string; values: number[] }>;
}

export function useInstallationsSeries(
  dateRange: { from: Date; to: Date },
  filters: Filters
) {
  const [data, setData] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();

    if (dateRange.from)
      params.set("from", dateRange.from.toISOString().slice(0, 10));
    if (dateRange.to)
      params.set("to", dateRange.to.toISOString().slice(0, 10));

    if (filters.usuario) params.set("usuario", String(filters.usuario));
    if (filters.modelo) params.set("modelo", String(filters.modelo));
    if (filters.equipamento)
      params.set("equipamento", String(filters.equipamento));
    if (filters.serie) params.set("serie", String(filters.serie));
    if (filters.status) params.set("status", String(filters.status));

    setLoading(true);
    setError(null);

    fetch(`/api/series/installations?${params.toString()}`, {
      headers: { "x-user-email": "acquareduz@icehot.net.br" },
    })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [dateRange, filters]);

  return { data, loading, error };
}

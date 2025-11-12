import { useEffect, useState } from "react";
import type { Filters } from "@/lib/types";
import { apiFetch } from "@/lib/api";

interface LocationSummaryData {
  columns: string[];
  rows: (string | number)[][];
  total: number;
  points?: Array<{
    cidade: string;
    uf: string;
    lat?: number | null;
    lng?: number | null;
    totalEquip?: number;
    ativos?: number;
    inativos?: number;
    litrosTotal?: number;
  }>;
}

export function useLocationSummary(
  dateRange: { from: Date; to: Date },
  filters: Filters
) {
  const [data, setData] = useState<LocationSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

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

        const res = await apiFetch(`/api/location/summary?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Erro ${res.status} ao carregar resumo de localização${
              txt ? `: ${txt}` : ""
            }`
          );
        }

        const json = (await res.json()) as LocationSummaryData;
        setData(json);
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setError(e?.message || "Erro ao carregar resumo de localização");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [dateRange, filters]);

  return { data, loading, error };
}
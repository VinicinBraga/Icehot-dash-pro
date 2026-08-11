import { useEffect, useState } from "react";
import type { Filters } from "@/lib/types";
import { apiFetch } from "@/lib/api";

interface LocationKpis {
  users_total: number;
  equipamentos_ativos: number;
  equipamentos_inativos: number;
}

export function useLocationKpis(
  dateRange: { from: Date; to: Date },
  filters: Filters,
  enabled = true
) {
  const [data, setData] = useState<LocationKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
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

        const res = await apiFetch(
          `/api/location/kpis?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Erro ${res.status} ao carregar KPIs de localização${
              txt ? `: ${txt}` : ""
            }`
          );
        }

        const json = (await res.json()) as LocationKpis;
        setData(json);
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setError(e?.message || "Erro ao carregar KPIs de localização");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [dateRange, filters, enabled]);

  return { data, loading, error };
}

import { useEffect, useState } from "react";
import { fetchHotTemperatureTable } from "@/lib/api";
type Filters = any;

type TableData = {
  columns: any[];
  rows: any[];
  total: number;
};// ajuste se seus types estiverem em outro lugar

type HotTempTableData = TableData & { hidden?: boolean };

export function useHotTemperatureTable(from: Date, to: Date, filters?: Filters) {
  const [data, setData] = useState<HotTempTableData>({
    columns: [],
    rows: [],
    total: 0,
    hidden: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetchHotTemperatureTable(from, to, filters);

        if (!alive) return;

        setData({
          columns: res?.columns || [],
          rows: res?.rows || [],
          total: Number(res?.total || 0),
          hidden: Boolean(res?.hidden),
        });
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Falha ao buscar tabela de temperatura");
        setData({ columns: [], rows: [], total: 0, hidden: true });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [from, to, JSON.stringify(filters || {})]);

  return { data, loading, error };
}
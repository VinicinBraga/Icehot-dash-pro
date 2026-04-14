import { useEffect, useState } from "react";
import { fetchHotTemperatureTable } from "@/lib/api";
type Filters = any;

type TableData = {
  columns: any[];
  rows: any[];
  total: number;
};

type TempTableBlock = TableData & { hidden?: boolean };

type HotTempTableData = {
  hot: TempTableBlock;
  cold: TempTableBlock;
};

export function useHotTemperatureTable(from: Date, to: Date, filters?: Filters) {
  const [data, setData] = useState<HotTempTableData>({
    hot: {
      columns: [],
      rows: [],
      total: 0,
      hidden: true,
    },
    cold: {
      columns: [],
      rows: [],
      total: 0,
      hidden: true,
    },
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
          hot: {
            columns: res?.hot?.columns || [],
            rows: res?.hot?.rows || [],
            total: Number(res?.hot?.total || 0),
            hidden: Boolean(res?.hot?.hidden),
          },
          cold: {
            columns: res?.cold?.columns || [],
            rows: res?.cold?.rows || [],
            total: Number(res?.cold?.total || 0),
            hidden: Boolean(res?.cold?.hidden),
          },
        });
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Falha ao buscar tabela de temperatura");
        setData({
          hot: { columns: [], rows: [], total: 0, hidden: true },
          cold: { columns: [], rows: [], total: 0, hidden: true },
        });
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
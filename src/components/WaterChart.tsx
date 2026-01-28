// src/components/WaterChart.tsx
import { Card } from "@/components/ui/card";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { formatLiters } from "@/lib/format";
import type { SeriesData } from "@/lib/types";
import { mockWaterSeries } from "@/lib/mockData";

type Modules = {
  fria?: boolean;
  quente?: boolean;
  pets?: boolean;
};

export function WaterChart({
  data,
  modules,
}: {
  data?: SeriesData;
  modules?: Modules;
}) {
  const series = data ?? mockWaterSeries;

  // ✅ defaults: se não vier modules, mostra tudo
  const m: Required<Modules> = {
    fria: modules?.fria !== false,
    quente: modules?.quente !== false,
    pets: modules?.pets !== false,
  };

  const dataPoints = series.labels.map((label, idx) => ({
    name: label,
    total: Number(series.series[0]?.values[idx] ?? 0),
    fria: m.fria ? Number(series.series[1]?.values[idx] ?? 0) : undefined,
    quente: m.quente ? Number(series.series[2]?.values[idx] ?? 0) : undefined,
    pets: m.pets ? Number(series.series[3]?.values[idx] ?? 0) : undefined,
  }));

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">
        Total de Litros ao Longo do Tempo
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dataPoints}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(val) => formatLiters(Number(val))}
          />
          <Tooltip
            formatter={(value: number) => `${formatLiters(value)} L`}
            labelFormatter={(label) => label}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
            }}
          />
          <Legend />

          <Bar dataKey="total" fill="hsl(var(--chart-1))" name="Total (L)" />

          {m.fria && (
            <Line
              type="monotone"
              dataKey="fria"
              stroke="hsl(var(--chart-2))"
              name="Fria (L)"
              strokeWidth={2}
            />
          )}

          {m.quente && (
            <Line
              type="monotone"
              dataKey="quente"
              stroke="hsl(var(--chart-3))"
              name="Quente (L)"
              strokeWidth={2}
            />
          )}

          {m.pets && (
            <Line
              type="monotone"
              dataKey="pets"
              stroke="hsl(var(--chart-4))"
              name="Pets (L)"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

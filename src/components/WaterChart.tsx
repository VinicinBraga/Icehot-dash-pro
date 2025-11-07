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

export function WaterChart({ data }: { data?: SeriesData }) {
  const series = data ?? mockWaterSeries;

  const dataPoints = series.labels.map((label, idx) => ({
    name: label,
    total: Number(series.series[0]?.values[idx] ?? 0),
    fria: Number(series.series[1]?.values[idx] ?? 0),
    quente: Number(series.series[2]?.values[idx] ?? 0),
    pets: Number(series.series[3]?.values[idx] ?? 0),
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
            formatter={(value: number, _name, _props) =>
              `${formatLiters(value)} L`
            }
            labelFormatter={(label) => label}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
            }}
          />
          <Legend />
          <Bar dataKey="total" fill="hsl(var(--chart-1))" name="Total (L)" />
          <Line
            type="monotone"
            dataKey="fria"
            stroke="hsl(var(--chart-2))"
            name="Fria (L)"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="quente"
            stroke="hsl(var(--chart-3))"
            name="Quente (L)"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="pets"
            stroke="hsl(var(--chart-4))"
            name="Pets (L)"
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

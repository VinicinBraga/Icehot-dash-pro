import React from "react";
import { Card } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatNumber } from "@/lib/format";

export interface CumulativeSeriesData {
  labels: string[];
  series: Array<{ key: string; values: number[] }>;
}

interface CumulativeChartProps {
  data?: CumulativeSeriesData | null;
}

export const CumulativeChart: React.FC<CumulativeChartProps> = ({ data }) => {
  const chartData =
    data && data.labels && data.series && data.series[0]
      ? data.labels.map((label, i) => ({
          name: label,
          acumulado: data.series[0].values[i] ?? 0,
        }))
      : [];

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Acumulado de Equipamentos</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(value: any) => formatNumber(Number(value))}
          />
          <Tooltip
            formatter={(value: any) => formatNumber(Number(value))}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
            }}
          />
          <Area
            type="monotone"
            dataKey="acumulado"
            stroke="hsl(var(--chart-1))"
            fill="hsl(var(--chart-1))"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default CumulativeChart;

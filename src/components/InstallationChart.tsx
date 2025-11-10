import React from "react";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatNumber } from "@/lib/format";

export interface InstallationSeriesData {
  labels: string[];
  series: Array<{ key: string; values: number[] }>;
}

interface InstallationChartProps {
  data?: InstallationSeriesData | null;
}

export const InstallationChart: React.FC<InstallationChartProps> = ({
  data,
}) => {
  const chartData =
    data && data.labels && data.series && data.series[0]
      ? data.labels.map((label, i) => ({
          name: label,
          instalacoes: data.series[0].values[i] ?? 0,
        }))
      : [];

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Instalações por Mês</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
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
          <Line
            type="monotone"
            dataKey="instalacoes"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default InstallationChart;

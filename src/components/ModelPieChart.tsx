// src/components/ModelPieChart.tsx
import { Card } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { PieData } from "@/lib/types";
import { mockPieData } from "@/lib/mockData";
import { formatNumber } from "@/lib/format";

interface ModelPieChartProps {
  data?: PieData[];
}

// cores básicas (ajuste se quiser)
const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ModelPieChart({ data }: ModelPieChartProps) {
  const pie = data && data.length ? data : mockPieData;

  const total = pie.reduce((sum, item) => sum + (item.value || 0), 0) || 1;

  const formatLiters = (value: number) =>
    `${formatNumber(value, { decimals: 2 })} L`;

  const formatPercent = (value: number) =>
    `${(value * 100).toFixed(2).replace(".", ",")}%`;

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">
        Distribuição de Consumo por Modelo
      </h3>

      <div className="w-full h-[320px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pie}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={2}
              isAnimationActive
              // label com porcentagem, só para fatias relevantes
              label={({ name, value }) => {
                const v = Number(value || 0);
                const pct = (v / total) * 100;
                if (!v || pct < 5) return ""; // evita poluição
                return `${name}: ${pct.toFixed(1)}%`;
              }}
              labelLine={false}
            >
              {pie.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value: any, _name: any, props: any) => {
                const v = Number(value || 0);
                const pct = v / total;
                return [
                  `${formatLiters(v)} (${formatPercent(pct)})`,
                  "Consumo",
                ];
              }}
              labelFormatter={(label: any) => String(label)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.75rem",
                fontSize: "0.8rem",
              }}
            />

            <Legend
              formatter={(value: any, entry: any) => {
                const v = Number(entry?.payload?.value || 0);
                const pct = v / total;
                return `${value} (${formatPercent(pct)})`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

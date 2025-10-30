import { Card } from "@/components/ui/card";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { mockWaterSeries } from "@/lib/mockData";
import { formatNumber } from "@/lib/format";

export function WaterChart() {
  const data = mockWaterSeries.labels.map((label, idx) => ({
    name: label,
    total: mockWaterSeries.series[0].values[idx],
    fria: mockWaterSeries.series[1].values[idx],
    quente: mockWaterSeries.series[2].values[idx],
    pets: mockWaterSeries.series[3].values[idx],
  }));

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Total de Litros ao Longo do Tempo</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
          <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(val) => formatNumber(val)} />
          <Tooltip
            formatter={(value: number) => formatNumber(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
            }}
          />
          <Legend />
          <Bar dataKey="total" fill="hsl(var(--chart-1))" name="Total" />
          <Line type="monotone" dataKey="fria" stroke="hsl(var(--chart-2))" name="Fria" strokeWidth={2} />
          <Line type="monotone" dataKey="quente" stroke="hsl(var(--chart-3))" name="Quente" strokeWidth={2} />
          <Line type="monotone" dataKey="pets" stroke="hsl(var(--chart-4))" name="Pets" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

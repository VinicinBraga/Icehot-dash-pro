import { Card } from "@/components/ui/card";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { mockTriggerSeries } from "@/lib/mockData";
import { formatNumber } from "@/lib/format";

export function TriggerChart() {
  const data = mockTriggerSeries.labels.map((label, idx) => ({
    name: label,
    total: mockTriggerSeries.series[0].values[idx],
    fria: mockTriggerSeries.series[1].values[idx],
    quente: mockTriggerSeries.series[2].values[idx],
    pets: mockTriggerSeries.series[3].values[idx],
    aspersor: mockTriggerSeries.series[4].values[idx],
  }));

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Total de Acionamentos</h3>
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
          <Line type="monotone" dataKey="aspersor" stroke="hsl(var(--chart-5))" name="Aspersor" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

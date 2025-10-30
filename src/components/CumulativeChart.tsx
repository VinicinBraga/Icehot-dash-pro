import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { mockCumulativeSeries } from "@/lib/mockData";

export function CumulativeChart() {
  const data = mockCumulativeSeries.labels.map((label, idx) => ({
    name: label,
    acumulado: mockCumulativeSeries.series[0].values[idx],
  }));

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Acumulado de Equipamentos</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
          <YAxis stroke="hsl(var(--muted-foreground))" />
          <Tooltip
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
            name="Acumulado"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

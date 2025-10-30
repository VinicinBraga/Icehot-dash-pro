import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { mockInstallationSeries } from "@/lib/mockData";

export function InstallationChart() {
  const data = mockInstallationSeries.labels.map((label, idx) => ({
    name: label,
    instalacoes: mockInstallationSeries.series[0].values[idx],
  }));

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Instalações por Mês</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
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
          <Line type="monotone" dataKey="instalacoes" stroke="hsl(var(--chart-1))" strokeWidth={2} name="Instalações" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

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
import { formatNumber } from "@/lib/format";
import type { SeriesData } from "@/lib/types";
import { mockTriggerSeries } from "@/lib/mockData";

type Modules = {
  agua_gelada?: number | boolean; // backend manda 0/1
  agua_quente?: number | boolean;
  agua_pet?: number | boolean;
  aspersor?: number | boolean; // backend manda 0/1
};

export function TriggerChart({
  data,
  modules,
}: {
  data?: SeriesData;
  modules?: Modules;
}) {
  const series = data ?? mockTriggerSeries;
  const asBool = (v: unknown, fallback = true) => {
    if (v === undefined || v === null) return fallback;
    if (v === true || v === 1 || v === "1") return true;
    if (v === false || v === 0 || v === "0") return false;
    return fallback;
  };
  // ✅ defaults: se não vier modules, mostra tudo
  const m = {
    fria: asBool(modules?.agua_gelada, true),
    quente: asBool(modules?.agua_quente, true),
    pets: asBool(modules?.agua_pet, true),
    aspersor: asBool(modules?.aspersor, false), // ✅ default do aspersor: NÃO mostrar se não vier
  };

  const dataPoints = series.labels.map((label, idx) => ({
    name: label,
    total: series.series[0]?.values[idx] ?? 0,
    fria: m.fria ? series.series[1]?.values[idx] ?? 0 : undefined,
    quente: m.quente ? series.series[2]?.values[idx] ?? 0 : undefined,
    pets: m.pets ? series.series[3]?.values[idx] ?? 0 : undefined,
    // ✅ aspersor agora segue a mesma regra (some quando não tiver)
    aspersor: m.aspersor ? series.series[4]?.values[idx] ?? 0 : undefined,
  }));

  return (
    <Card className="p-6 rounded-2xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Total de Acionamentos</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dataPoints}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(val) => formatNumber(val)}
          />
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

          {m.fria && (
            <Line
              type="monotone"
              dataKey="fria"
              stroke="hsl(var(--chart-2))"
              name="Fria"
              strokeWidth={2}
            />
          )}

          {m.quente && (
            <Line
              type="monotone"
              dataKey="quente"
              stroke="hsl(var(--chart-3))"
              name="Quente"
              strokeWidth={2}
            />
          )}

          {m.pets && (
            <Line
              type="monotone"
              dataKey="pets"
              stroke="hsl(var(--chart-4))"
              name="Pets"
              strokeWidth={2}
            />
          )}

          {m.aspersor && (
            <Line
              type="monotone"
              dataKey="aspersor"
              stroke="hsl(var(--chart-5))"
              name="Aspersor"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

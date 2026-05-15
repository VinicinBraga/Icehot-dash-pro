import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card } from "@/components/ui/card";
import type { TemperatureHistoryEquipment } from "@/lib/api";

type Props = {
  equipment: TemperatureHistoryEquipment;
};

export function TemperatureHistoryChart({ equipment }: Props) {
  const data = equipment.labels.map((label, index) => {
    const dateOnly = label.slice(0, 10);
    const [year, month, day] = dateOnly.split("-");
  
    return {
      horario: `${day}-${month}-${year.slice(2)}`,
      quente: equipment.series.find((s) => s.key === "quente")?.values[index],
      fria: equipment.series.find((s) => s.key === "fria")?.values[index],
    };
  });

  return (
    <Card className="p-5 rounded-2xl border border-border shadow-sm">
      <h3 className="text-base font-semibold mb-4">
        {equipment.maquina_nome}
      </h3>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="horario" />
          <YAxis unit="°C" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="quente"
            name="Água quente"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="fria"
            name="Água fria"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
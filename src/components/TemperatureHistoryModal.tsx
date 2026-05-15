import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemperatureHistoryChart } from "@/components/TemperatureHistoryChart";
import type { TemperatureHistoryResponse } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  data?: TemperatureHistoryResponse;
  loading?: boolean;
  error?: string | null;
  selectedDays: number;
  onChangeDays: (days: number) => void;
};

export function TemperatureHistoryModal({
  open,
  onClose,
  data,
  loading,
  error,
  selectedDays,
  onChangeDays,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 mb-6">
        <div>
            <h2 className="text-2xl font-semibold">
              Histórico de Temperatura
            </h2>
            <p className="text-sm text-muted-foreground">
              Evolução da temperatura por equipamento no período selecionado.
            </p>
          </div>

          <Button size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {[7, 15, 30, 90].map((days) => (
              <Button
                key={days}
                type="button"
                variant={selectedDays === days ? "default" : "outline"}
                className="rounded-full"
                onClick={() => onChangeDays(days)}
              >
                {days} dias
              </Button>
            ))}
          </div>


        {loading && (
          <p className="text-sm text-muted-foreground">
            Carregando histórico...
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600">
            Erro ao carregar histórico: {error}
          </p>
        )}

        {!loading && !error && !data?.equipments?.length && (
          <p className="text-sm text-muted-foreground">
            Nenhum histórico de temperatura encontrado para o período.
          </p>
        )}

        <div className="space-y-5">
          {data?.equipments?.map((equipment) => (
            <TemperatureHistoryChart
              key={equipment.maquina_id}
              equipment={equipment}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
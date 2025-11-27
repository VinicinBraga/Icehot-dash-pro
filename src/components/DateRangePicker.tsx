// src/components/DateRangePicker.tsx
import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  parseISO,
  isValid,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateRange {
  from: Date;
  to: Date;
}
interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  // estado rascunho para o calendário/inputs (não fecha no 1º clique)
  const [draft, setDraft] = useState<DateRange>(() => ({
    from: value.from,
    to: value.to,
  }));

  // sempre que abrir, sincroniza draft com o value atual
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) setDraft({ from: value.from, to: value.to });
  };

  const pretty = useMemo(() => {
    if (!value?.from || !value?.to) return "Selecione o período";
    const sameYear = value.from.getFullYear() === value.to.getFullYear();
    const left = format(value.from, "dd MMM", { locale: ptBR });
    const right = format(value.to, sameYear ? "dd MMM, yyyy" : "dd MMM, yyyy", {
      locale: ptBR,
    });
    return `${left} - ${right}`;
  }, [value]);

  const presets = [
    { label: "Hoje", getValue: () => ({ from: new Date(), to: new Date() }) },
    {
      label: "7 dias",
      getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }),
    },
    {
      label: "30 dias",
      getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    },
    {
      label: "Mês Atual",
      getValue: () => ({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      }),
    },
    {
      label: "Ano Atual",
      getValue: () => ({ from: startOfYear(new Date()), to: new Date() }),
    },
  ];

  // helpers p/ inputs (YYYY-MM-DD)
  const toYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const setDraftFrom = (s: string) => {
    const d = parseISO(s);
    if (isValid(d))
      setDraft((prev) => ({ from: d, to: prev.to < d ? d : prev.to }));
  };
  const setDraftTo = (s: string) => {
    const d = parseISO(s);
    if (isValid(d))
      setDraft((prev) => ({ from: prev.from > d ? d : prev.from, to: d }));
  };

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      /* @radix/shadcn suporta modal */ modal
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            // tamanho e formato
            "h-11 w-full rounded-full px-5 flex items-center gap-2 justify-center",
            "text-sm font-medium bg-white border border-border",
            // hover azul #1105f2
            "hover:bg-[#1105f2] hover:text-white hover:border-[#1105f2]",
            "transition-all duration-200",
            // estilo quando não há valor
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-5 h-4 w-4" />
          {pretty}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()} // nunca fecha “sem querer”
      >
        <div className="flex" onMouseDown={(e) => e.stopPropagation()}>
          {/* Presets */}
          <div className="border-r p-3 space-y-1 min-w-[140px]">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  const p = preset.getValue();
                  setDraft(p);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Calendário + inputs */}
          <div className="p-3 space-y-3">
            {/* Inputs de data */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Input
                  type="date"
                  defaultValue={toYMD(draft.from)}
                  onChange={(e) => setDraftFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input
                  type="date"
                  defaultValue={toYMD(draft.to)}
                  onChange={(e) => setDraftTo(e.target.value)}
                />
              </div>
            </div>

            <Calendar
              initialFocus
              mode="range"
              numberOfMonths={2}
              locale={ptBR}
              defaultMonth={draft.from ?? new Date()}
              selected={{ from: draft.from, to: draft.to }}
              onSelect={(range) => {
                if (!range) return;
                // 1º clique: define só o from (to = from para exibir seleção)
                if (range.from && !range.to) {
                  setDraft({ from: range.from, to: range.from });
                  return;
                }
                // 2º clique: fecha o range no to
                if (range.from && range.to) {
                  setDraft({ from: range.from, to: range.to });
                }
              }}
              className="pointer-events-auto"
            />

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const from = draft.from;
                  const to = draft.to < draft.from ? draft.from : draft.to;
                  onChange({ from, to });
                  setOpen(false);
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

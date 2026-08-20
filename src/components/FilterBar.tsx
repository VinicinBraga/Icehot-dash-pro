import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMemo } from "react";
import { mockFilterOptions } from "@/lib/mockData";
import type { FilterOptions, Filters } from "@/lib/types";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  // 🔹 novos props para dados reais
  options?: FilterOptions | null;
  loading?: boolean;
  error?: string | null;
}

export function FilterBar({
  filters,
  onChange,
  options,
  loading = false,
}: FilterBarProps) {
  // fallback para mocks se ainda não veio nada do backend
  const opts: FilterOptions = useMemo(() => {
    if (
      options &&
      (options.usuarios?.length ||
        options.modelos?.length ||
        options.equipamentos?.length ||
        options.series?.length)
    ) {
      return options;
    }
    return mockFilterOptions;
  }, [options]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6 bg-card rounded-2xl border border-border shadow-sm">
      {/* Usuário */}
      <Select
        value={filters.usuario?.toString()}
        onValueChange={(value) =>
          onChange({
            ...filters,
            usuario: value === "all" ? undefined : Number(value),
          })
        }
        disabled={loading}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Usuário" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all"></SelectItem>
          {opts.usuarios.map((u) => (
            <SelectItem key={u.value} value={u.value.toString()}>
              {u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Modelo */}
      <Select
        value={filters.modelo?.toString()}
        onValueChange={(value) =>
          onChange({
            ...filters,
            modelo: value === "all" ? undefined : Number(value),
          })
        }
        disabled={loading}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Modelo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {opts.modelos.map((m) => (
            <SelectItem key={m.value} value={m.value.toString()}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

{/* Equipamento */}
<Popover>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      disabled={loading}
      className="w-full justify-between rounded-xl font-normal"
    >
      <span className="truncate">
        {!filters.equipamentos?.length
          ? "Equipamento"
          : filters.equipamentos.length === 1
            ? opts.equipamentos.find(
                (e) => Number(e.value) === filters.equipamentos?.[0]
              )?.label ?? "1 equipamento selecionado"
            : `${filters.equipamentos.length} equipamentos selecionados`}
      </span>

      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>

  <PopoverContent
    align="start"
    className="w-[var(--radix-popover-trigger-width)] p-2"
  >
    <div className="max-h-64 overflow-y-auto">
      {opts.equipamentos.map((e) => {
        const id = Number(e.value);
        const selected = filters.equipamentos?.includes(id) ?? false;

        return (
          <label
            key={e.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-accent"
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => {
                const atuais = filters.equipamentos ?? [];

                const equipamentos = checked
                  ? [...atuais, id]
                  : atuais.filter((item) => item !== id);

                onChange({
                  ...filters,
                  equipamentos:
                    equipamentos.length > 0 ? equipamentos : undefined,
                });
              }}
            />

            <span className="text-sm">{e.label}</span>
          </label>
        );
      })}
    </div>
  </PopoverContent>
</Popover>

      {/* Nº de Série *
      <Select
        value={filters.serie}
        onValueChange={(value) =>
          onChange({ ...filters, serie: value === "all" ? undefined : value })
        }
        disabled={loading}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Nº de Série" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {opts.series.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>*/}

      {/* Status */}
      <Select
        value={filters.status ?? "all"}
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value === "all" ? undefined : value, // não manda status quando for "Todos"
          })
        }
        disabled={loading}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Status</SelectItem>
          <SelectItem value="0">Ativos</SelectItem>
          <SelectItem value="2">Inativos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

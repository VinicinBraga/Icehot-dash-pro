import { useMemo } from "react";
import { mockFilterOptions } from "@/lib/mockData";
import type { FilterOptions } from "@/lib/types";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Filters {
  usuario?: number;
  modelo?: number;
  equipamento?: number;
  serie?: string;
  status?: string;
}

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
          <SelectItem value="all">Todos</SelectItem>
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
      <Select
        value={filters.equipamento?.toString()}
        onValueChange={(value) =>
          onChange({
            ...filters,
            equipamento: value === "all" ? undefined : Number(value),
          })
        }
        disabled={loading}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Equipamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {opts.equipamentos.map((e) => (
            <SelectItem key={e.value} value={e.value.toString()}>
              {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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

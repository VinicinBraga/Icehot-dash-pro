import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockFilterOptions } from "@/lib/mockData";

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
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-6 bg-card rounded-2xl border border-border shadow-sm">
      <Select
        value={filters.usuario?.toString()}
        onValueChange={(value) => onChange({ ...filters, usuario: value === 'all' ? undefined : Number(value) })}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Usuário" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {mockFilterOptions.usuarios.map((u) => (
            <SelectItem key={u.value} value={u.value.toString()}>
              {u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.modelo?.toString()}
        onValueChange={(value) => onChange({ ...filters, modelo: value === 'all' ? undefined : Number(value) })}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Modelo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {mockFilterOptions.modelos.map((m) => (
            <SelectItem key={m.value} value={m.value.toString()}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.equipamento?.toString()}
        onValueChange={(value) => onChange({ ...filters, equipamento: value === 'all' ? undefined : Number(value) })}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Equipamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {mockFilterOptions.equipamentos.map((e) => (
            <SelectItem key={e.value} value={e.value.toString()}>
              {e.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.serie}
        onValueChange={(value) => onChange({ ...filters, serie: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Nº de Série" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {mockFilterOptions.series.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(value) => onChange({ ...filters, status: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="rounded-xl">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {mockFilterOptions.status.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { ReactNode } from "react";

interface DataTableProps {
  title: ReactNode;
  columns: string[];
  rows: Array<Array<string | number | null>>;
  total?: number;
  pageSize?: number;
}

type SortDirection = "asc" | "desc";

function isISODateString(v: unknown) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function normalizeForSort(v: unknown) {
  if (v === null || v === undefined || v === "") {
    return { kind: "empty" as const, value: "" };
  }

  // YYYY-MM-DD (ex: 2025-12-19)
  if (isISODateString(v)) {
    const t = Date.parse(`${v}T00:00:00`);
    return { kind: "number" as const, value: Number.isNaN(t) ? 0 : t };
  }

  if (typeof v === "number") {
    return { kind: "number" as const, value: v };
  }

  const s = String(v).trim();

  // tenta número vindo como string (ex: "1.234", "12,3", "10")
  // (bem conservador pra não bagunçar texto)
  if (/^-?\d+([.,]\d+)?$/.test(s)) {
    const num = Number(s.replace(",", "."));
    if (!Number.isNaN(num)) {
      return { kind: "number" as const, value: num };
    }
  }

  return { kind: "string" as const, value: s.toLowerCase() };
}

export function DataTable({
  title,
  columns,
  rows,
  total,
  pageSize = 10,
}: DataTableProps) {
  const [page, setPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // === Helpers para destacar "Próx. troca filtro" ===
  const getFilterStatusClass = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "bg-muted text-muted-foreground";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);

    const diffMs = d.getTime() - today.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0) {
      return "bg-red-100 text-red-700"; // vencido
    } else if (diffDays <= 30) {
      return "bg-yellow-100 text-yellow-700"; // vence em até 1 mês
    } else {
      return "bg-emerald-100 text-emerald-700"; // em dia
    }
  };

  const isProxTrocaColumn = (index: number) => {
    const col = (columns[index] || "").toLowerCase();
    return (
      col.includes("próx. troca filtro") || col.includes("prox. troca filtro")
    );
  };

  const sortedRows = useMemo(() => {
    if (sortColumn === null) return rows;

    const copy = [...rows];

    copy.sort((a, b) => {
      const av = normalizeForSort(a[sortColumn]);
      const bv = normalizeForSort(b[sortColumn]);

      // vazios sempre por último
      if (av.kind === "empty" && bv.kind !== "empty") return 1;
      if (bv.kind === "empty" && av.kind !== "empty") return -1;

      let cmp = 0;

      if (av.kind === "number" && bv.kind === "number") {
        cmp = (av.value as number) - (bv.value as number);
      } else {
        // string fallback (pt-BR)
        cmp = String(av.value).localeCompare(String(bv.value), "pt-BR");
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });

    return copy;
  }, [rows, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const handleSort = (colIndex: number) => {
    // ao trocar sort, volta pra página 1 (evita página vazia)
    setPage(0);

    if (sortColumn === colIndex) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(colIndex);
      setSortDirection("asc"); // começa asc (mais natural)
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, idx) => {
                const active = sortColumn === idx;
                const icon = active
                  ? sortDirection === "asc"
                    ? "▲"
                    : "▼"
                  : null;

                return (
                  <TableHead key={idx} className="font-semibold">
                    <button
                      onClick={() => handleSort(idx)}
                      className="flex items-center gap-2 hover:text-foreground transition-colors"
                      title="Clique para ordenar"
                    >
                      <span>{col}</span>

                      {/* Ícone padrão + seta quando ativo */}
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <ArrowUpDown className="h-4 w-4" />
                        {icon ? <span className="text-xs">{icon}</span> : null}
                      </span>
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedRows.map((row, idx) => (
              <TableRow key={idx}>
                {row.map((cell, cellIdx) => {
                  let display: string | number = cell as any;

                  if (typeof cell === "number") {
                    // Tabela específica: "Equipamentos por Localização"
                    const isLocationTable =
                      title === "Equipamentos por Localização";
                    // Colunas 1, 2 e 3 = Total / Ativos / Inativos
                    const isCountColumn =
                      cellIdx === 1 || cellIdx === 2 || cellIdx === 3;

                    if (isLocationTable && isCountColumn) {
                      display = new Intl.NumberFormat("pt-BR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(cell);
                    } else {
                      display = formatNumber(cell);
                    }
                  }

                  // destaque visual da coluna "Próx. troca filtro" se vier YYYY-MM-DD
                  const proxTrocaCol = isProxTrocaColumn(cellIdx);
                  const proxTrocaVal =
                    typeof cell === "string" && isISODateString(cell)
                      ? cell
                      : null;

                  if (proxTrocaCol && proxTrocaVal) {
                    return (
                      <TableCell key={cellIdx}>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getFilterStatusClass(
                            proxTrocaVal
                          )}`}
                        >
                          {proxTrocaVal}
                        </span>
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell key={cellIdx}>
                      {display === null || display === "0"
                        ? "0"
                        : display || ""}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="p-4 border-t border-border flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {typeof total === "number" ? `Total de equipamentos: ${total}` : ""}
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm">
            Página {Math.min(page + 1, totalPages)} de {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

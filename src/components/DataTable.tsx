import { useState } from "react";
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

interface DataTableProps {
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
  total?: number;
  pageSize?: number;
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
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedRows = [...rows].sort((a, b) => {
    if (sortColumn === null) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  const paginatedRows = sortedRows.slice(
    page * pageSize,
    (page + 1) * pageSize
  );
  const totalPages = Math.ceil(rows.length / pageSize);

  const handleSort = (colIndex: number) => {
    if (sortColumn === colIndex) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(colIndex);
      setSortDirection("desc");
    }
  };

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

  return (
    <Card className="rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead key={idx} className="font-semibold">
                  <button
                    onClick={() => handleSort(idx)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {col}
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row, idx) => (
              <TableRow key={idx}>
                {row.map((cell, cellIdx) => {
                  let display: string | number = cell;

                  if (typeof cell === "number") {
                    // Tabela específica: "Equipamentos por Localização"
                    const isLocationTable =
                      title === "Equipamentos por Localização";
                    // Colunas 1, 2 e 3 = Total / Ativos / Inativos
                    const isCountColumn =
                      cellIdx === 1 || cellIdx === 2 || cellIdx === 3;

                    if (isLocationTable && isCountColumn) {
                      // Formata como número inteiro (sem casas decimais)
                      display = new Intl.NumberFormat("pt-BR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(cell);
                    } else {
                      // Demais casos continuam usando o formatNumber padrão
                      display = formatNumber(cell);
                    }
                  }

                  return (
                    <TableCell key={cellIdx}>
                      {display === 0 ? "0" : display}
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
          {total && `Total de equipamentos: ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

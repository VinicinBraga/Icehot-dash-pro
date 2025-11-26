// src/components/KpiCard.tsx
import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: number | string;
  helpText?: string;
  suffix?: string;
  formatter?: (v: number) => string;
  icon?: ReactNode; // 👈 ícone opcional
}

export function KpiCard({
  label,
  value,
  helpText,
  suffix = "",
  formatter,
  icon,
}: KpiCardProps) {
  const display = formatter ? formatter(Number(value)) : value;

  return (
    <Card className="relative p-4 rounded-xl shadow-sm border border-border overflow-hidden">
      {/* Ícone no canto inferior direito */}
      {icon && (
        <div className="absolute bottom-2 right-2 pointer-events-none">
          <div className="h-8 w-8 text-primary/40">
            {/* os ícones do lucide pegam a cor de `currentColor` */}
            {icon}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">{label}</div>

      <div className="text-2xl font-semibold mt-1">
        {display}
        {suffix ? ` ${suffix}` : ""}
      </div>

      {helpText && (
        <div className="text-xs text-muted-foreground mt-1">{helpText}</div>
      )}
    </Card>
  );
}

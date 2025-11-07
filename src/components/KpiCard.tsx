import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

type KpiCardProps = {
  label: string;
  value: number;
  helpText?: string;
  suffix?: string;
  formatter?: (n: number) => string; // <--- NOVO
};

export function KpiCard({
  label,
  value,
  helpText,
  suffix,
  formatter,
}: KpiCardProps) {
  const text = formatter ? formatter(value) : String(value);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">
        {text}
        {suffix ? ` ${suffix}` : ""}
      </div>
      {helpText && (
        <div className="text-xs text-muted-foreground mt-1">{helpText}</div>
      )}
    </div>
  );
}

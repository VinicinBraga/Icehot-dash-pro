import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

interface KpiCardProps {
  label: string;
  value: number;
  suffix?: string;
  helpText?: string;
  className?: string;
}

export function KpiCard({ label, value, suffix, helpText, className }: KpiCardProps) {
  return (
    <Card className={cn("p-6 rounded-2xl shadow-sm border border-border", className)}>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1">
          <p className="text-3xl font-bold text-foreground">
            {formatNumber(value)}
          </p>
          {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
        </div>
        {helpText && <p className="text-xs text-muted-foreground mt-1">{helpText}</p>}
      </div>
    </Card>
  );
}

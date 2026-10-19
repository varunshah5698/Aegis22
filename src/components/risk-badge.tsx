import { AlertTriangle, OctagonAlert, ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/config/risk";
import { cn } from "@/lib/utils";

const config = {
  low: { label: "Low", icon: ShieldCheck, variant: "low" as const },
  medium: { label: "Medium", icon: AlertTriangle, variant: "medium" as const },
  high: { label: "High", icon: ShieldAlert, variant: "high" as const },
  critical: { label: "Critical", icon: OctagonAlert, variant: "critical" as const },
};

export function RiskBadge({
  level,
  className,
  showScore,
  score,
}: {
  level: RiskLevel;
  className?: string;
  showScore?: boolean;
  score?: number;
}) {
  const item = config[level];
  const Icon = item.icon;
  return (
    <Badge variant={item.variant} className={cn("gap-1", className)}>
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
      {showScore && typeof score === "number" ? (
        <span className="num ml-0.5 opacity-80">{Math.round(score)}</span>
      ) : null}
    </Badge>
  );
}

export function riskLabel(level: RiskLevel): string {
  return config[level].label;
}

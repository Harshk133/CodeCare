import { cn } from "@/lib/utils";

const SEVERITY = {
  high: { dot: "bg-destructive", label: "High severity" },
  medium: { dot: "bg-caution", label: "Medium severity" },
  low: { dot: "bg-safe", label: "Low severity" },
} as const;

export function SeverityMark({
  severity,
  className,
}: {
  severity: keyof typeof SEVERITY;
  className?: string;
}) {
  const s = SEVERITY[severity];
  return (
    <span className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

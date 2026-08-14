import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1.5 text-2xl font-semibold tabular leading-none">{value}</div>
        {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: "present" | "absent" | "incomplete" }) {
  if (status === "present")
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
        Present
      </Badge>
    );
  if (status === "incomplete")
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
        Incomplete
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Absent
    </Badge>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string | undefined; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

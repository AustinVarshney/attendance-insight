import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState, StatCard } from "@/components/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useImportBatches } from "@/hooks/useAttendanceData";

export const Route = createFileRoute("/_authenticated/import-history")({
  head: () => ({
    meta: [
      { title: "Import history — Attendance Graph" },
      {
        name: "description",
        content: "Every Petpooja attendance import with rows processed, punches inserted, duplicates skipped and warnings.",
      },
      { property: "og:title", content: "Import history — Attendance Graph" },
      {
        property: "og:description",
        content: "Every attendance import with punches inserted, duplicates skipped and validation messages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportHistoryPage,
});

type Message = { level?: string; message?: string };

function toMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m): m is Message => typeof m === "object" && m !== null);
}

function ImportHistoryPage() {
  const batchesQ = useImportBatches();
  const [open, setOpen] = useState<string | null>(null);

  const batches = batchesQ.data ?? [];
  const totals = batches.reduce(
    (acc, b) => ({
      inserted: acc.inserted + (b.punches_inserted ?? 0),
      skipped: acc.skipped + (b.punches_skipped ?? 0),
      errors: acc.errors + (b.error_count ?? 0),
    }),
    { inserted: 0, skipped: 0, errors: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Import history"
        description="Audit trail of every attendance file processed into the database."
      />

      {batchesQ.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : batchesQ.error ? (
        <EmptyState
          title="Could not load import history"
          description={batchesQ.error instanceof Error ? batchesQ.error.message : undefined}
        />
      ) : batches.length === 0 ? (
        <EmptyState
          title="No imports yet"
          description="Upload a Petpooja Excel or CSV export from the Import Attendance page to see it here."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Imports" value={batches.length} />
            <StatCard label="Punches inserted" value={totals.inserted} />
            <StatCard label="Duplicates skipped" value={totals.skipped} hint="Re-imports are safe" />
            <StatCard label="Errors" value={totals.errors} />
          </div>

          <Card className="mt-5 py-0">
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[36px]" />
                      <TableHead>File</TableHead>
                      <TableHead className="w-[110px]">Format</TableHead>
                      <TableHead className="w-[180px]">Period</TableHead>
                      <TableHead className="w-[90px] text-right">Rows</TableHead>
                      <TableHead className="w-[90px] text-right">Inserted</TableHead>
                      <TableHead className="w-[100px] text-right">Skipped</TableHead>
                      <TableHead className="w-[130px]">Status</TableHead>
                      <TableHead className="w-[170px]">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => {
                      const messages = toMessages(b.messages);
                      const isOpen = open === b.id;
                      return [
                        <TableRow key={b.id}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={isOpen ? "Hide messages" : "Show messages"}
                              onClick={() => setOpen(isOpen ? null : b.id)}
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate font-medium">{b.file_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {b.file_format}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular text-sm text-muted-foreground">
                            {b.period_start ? `${b.period_start} → ${b.period_end ?? b.period_start}` : "—"}
                          </TableCell>
                          <TableCell className="tabular text-right">{b.total_rows}</TableCell>
                          <TableCell className="tabular text-right">{b.punches_inserted}</TableCell>
                          <TableCell className="tabular text-right">{b.punches_skipped}</TableCell>
                          <TableCell>
                            {b.error_count > 0 ? (
                              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                                {b.error_count} error{b.error_count > 1 ? "s" : ""}
                              </Badge>
                            ) : b.warning_count > 0 ? (
                              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                                {b.warning_count} warning{b.warning_count > 1 ? "s" : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                                Clean
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(b.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>,
                        isOpen ? (
                          <TableRow key={`${b.id}-detail`}>
                            <TableCell colSpan={9} className="bg-muted/40">
                              {messages.length === 0 ? (
                                <p className="py-2 text-sm text-muted-foreground">
                                  No validation messages — every row was read cleanly.
                                </p>
                              ) : (
                                <ul className="max-h-64 space-y-1 overflow-y-auto py-1 text-sm">
                                  {messages.map((m, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <AlertTriangle
                                        className={
                                          m.level === "error"
                                            ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
                                            : "mt-0.5 h-3.5 w-3.5 shrink-0 text-warning"
                                        }
                                      />
                                      <span className="text-muted-foreground">{m.message}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <p className="pt-2 text-xs text-muted-foreground">
                                {b.employees_created} employees created · {b.employees_updated} updated
                              </p>
                            </TableCell>
                          </TableRow>
                        ) : null,
                      ];
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

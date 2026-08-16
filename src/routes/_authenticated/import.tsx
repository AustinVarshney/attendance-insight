import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { detectMapping, parseSheet, type ParseResult, type Sheet } from "@/lib/parser";
import { commitImport } from "@/lib/import-commit";
import { minutesToLabel } from "@/lib/attendance";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Import attendance — Attendance Graph" },
      { name: "description", content: "Import Petpooja wide or normalized Excel/CSV punch exports with preview and validation." },
      { property: "og:title", content: "Import attendance — Attendance Graph" },
      { property: "og:description", content: "Import Petpooja Excel/CSV punch exports with preview and validation." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const now = new Date();
  const [fbYear, setFbYear] = useState(now.getFullYear());
  const [fbMonth, setFbMonth] = useState(now.getMonth() + 1);
  const [fileName, setFileName] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setReadError(null);
    setParsed(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const first = wb.SheetNames[0];
      if (!first) throw new Error("The file contains no sheets.");
      const sheet = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first]!, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      }) as Sheet;
      const mapping = detectMapping(sheet, fbYear, fbMonth);
      const result = parseSheet(sheet, mapping, fbYear, fbMonth);
      setFileName(file.name);
      setTotalRows(Math.max(sheet.length - mapping.headerRowIndex - 1, 0));
      setParsed(result);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!parsed) return;
    setCommitting(true);
    try {
      const res = await commitImport(parsed, fileName, totalRows);
      await queryClient.invalidateQueries();
      toast.success(
        `Imported ${res.punchesInserted} punches (${res.punchesSkipped} duplicates skipped, ${res.employeesCreated} new employees)`,
      );
      setParsed(null);
      router.navigate({ to: "/import-history" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setCommitting(false);
    }
  };

  const errors = parsed?.messages.filter((m) => m.level === "error") ?? [];
  const warnings = parsed?.messages.filter((m) => m.level === "warning") ?? [];

  return (
    <div>
      <PageHeader
        title="Import attendance"
        description="Upload a Petpooja Excel/CSV export. Wide (one column per date, comma separated punches) and normalized (one punch per row) layouts are both supported."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose file</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="file">Excel or CSV file</Label>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="y">Fallback year</Label>
            <Input id="y" type="number" value={fbYear} onChange={(e) => setFbYear(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m">Fallback month</Label>
            <Input
              id="m"
              type="number"
              min={1}
              max={12}
              value={fbMonth}
              onChange={(e) => setFbMonth(Number(e.target.value))}
            />
          </div>
          <p className="self-end text-xs text-muted-foreground">
            Used only when the file's date headers omit the month or year.
          </p>
        </CardContent>
      </Card>

      {busy ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading file…
        </div>
      ) : null}

      {readError ? (
        <div className="mt-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>{readError}</div>
        </div>
      ) : null}

      {parsed ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Format" value={parsed.mapping.mode === "wide" ? "Wide" : "Normalized"} hint={fileName} />
            <StatCard label="Employees" value={parsed.employees.length} />
            <StatCard label="Punches" value={parsed.punches.length} />
            <StatCard
              label="Period"
              value={parsed.periodStart ? `${parsed.periodStart} → ${parsed.periodEnd}` : "—"}
            />
            <StatCard label="Issues" value={`${errors.length} / ${warnings.length}`} hint="errors / warnings" />
          </div>

          {parsed.messages.length ? (
            <Card className="mt-5">
              <CardHeader>
                <CardTitle className="text-base">2. Validation</CardTitle>
              </CardHeader>
              <CardContent className="max-h-56 space-y-1 overflow-y-auto text-sm">
                {parsed.messages.slice(0, 200).map((m, i) => (
                  <div
                    key={i}
                    className={m.level === "error" ? "text-destructive" : "text-muted-foreground"}
                  >
                    {m.level === "error" ? "Error" : "Warning"}: {m.message}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="mt-5 py-0">
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Punches</TableHead>
                      <TableHead>Sample</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.employees.slice(0, 50).map((e) => {
                      const mine = parsed.punches.filter((p) => p.employee_code === e.employee_code);
                      return (
                        <TableRow key={e.employee_code}>
                          <TableCell className="tabular font-medium">{e.employee_code}</TableCell>
                          <TableCell>{e.name}</TableCell>
                          <TableCell className="text-muted-foreground">{e.department ?? "—"}</TableCell>
                          <TableCell className="tabular text-right">{mine.length}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {mine.slice(0, 4).map((p) => `${p.date} ${minutesToLabel(p.minutes)}`).join(" · ") || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={commit} disabled={committing || parsed.punches.length === 0 || errors.length > 0}>
              {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Commit import
            </Button>
            <Button variant="outline" onClick={() => setParsed(null)} disabled={committing}>
              Discard
            </Button>
            <span className="text-xs text-muted-foreground">
              {errors.length
                ? "Fix the errors above before committing — nothing is saved yet."
                : "Re-importing the same file is safe — existing punches are skipped, never duplicated."}
            </span>
          </div>

        </>
      ) : busy ? null : (
        <div className="mt-5 flex items-center gap-2 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
          <Upload className="h-4 w-4" /> Select a file above to preview it before anything is saved.
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useAttendanceData";
import { minutesToHm, minutesToLabel, parseTimeToMinutes, punchType } from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/manual-entry")({
  validateSearch: z.object({
    employee: z.string().optional(),
    date: z.string().optional(),
  }),

  head: () => ({
    meta: [
      { title: "Manual punch entry — Attendance Graph" },
      {
        name: "description",
        content: "Add, edit or delete multiple attendance punches for an employee on any date.",
      },
      { property: "og:title", content: "Manual punch entry — Attendance Graph" },
      {
        property: "og:description",
        content: "Add, edit or delete multiple attendance punches for an employee on any date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManualEntryPage,
});

type Row = { key: string; value: string };

const newRow = (value = ""): Row => ({ key: Math.random().toString(36).slice(2), value });

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ManualEntryPage() {
  const queryClient = useQueryClient();
  const employeesQ = useEmployees();

  const search = Route.useSearch();

  const [employeeId, setEmployeeId] = useState(search.employee ?? "");
  const [date, setDate] = useState(search.date ?? todayIso());
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingCount, setExistingCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId || !date) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      const { data, error } = await supabase
        .from("attendance_punches")
        .select("id, punch_minutes")
        .eq("employee_id", employeeId)
        .eq("punch_date", date)
        .order("punch_minutes");
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setRows([newRow()]);
        setExistingCount(0);
      } else {
        const list = data ?? [];
        setExistingCount(list.length);
        setRows(list.length ? list.map((p) => newRow(minutesToHm(p.punch_minutes))) : [newRow()]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, date]);

  const parsedRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        minutes: r.value.trim() ? parseTimeToMinutes(r.value.trim()) : null,
        empty: !r.value.trim(),
      })),
    [rows],
  );

  const filled = parsedRows.filter((r) => !r.empty);
  const invalid = filled.filter((r) => r.minutes === null);
  const minutes = filled.map((r) => r.minutes!).filter((m) => m !== null);
  const duplicates = minutes.length !== new Set(minutes).size;
  const outOfOrder = minutes.some((m, i) => i > 0 && m <= minutes[i - 1]!);
  const sorted = [...minutes].sort((a, b) => a - b);

  const errors: string[] = [];
  if (invalid.length) errors.push(`${invalid.length} punch time${invalid.length > 1 ? "s" : ""} could not be read. Use HH:MM (e.g. 09:15) or 9:15 AM.`);
  if (duplicates) errors.push("Two punches have the exact same time. Remove the duplicate.");
  if (outOfOrder && !duplicates) errors.push("Punches must be in chronological order (earliest first).");

  const canSave = Boolean(employeeId) && Boolean(date) && errors.length === 0 && !loading && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Snapshot the current day so a failed insert can never leave the day empty.
      const { data: snapshot, error: snapErr } = await supabase
        .from("attendance_punches")
        .select("punch_minutes, source")
        .eq("employee_id", employeeId)
        .eq("punch_date", date);
      if (snapErr) throw snapErr;

      const { error: delErr } = await supabase
        .from("attendance_punches")
        .delete()
        .eq("employee_id", employeeId)
        .eq("punch_date", date);
      if (delErr) throw delErr;

      if (sorted.length) {
        const { error: insErr } = await supabase.from("attendance_punches").insert(
          sorted.map((m) => ({
            employee_id: employeeId,
            punch_date: date,
            punch_minutes: m,
            source: "manual",
          })),
        );
        if (insErr) {
          if (snapshot?.length) {
            await supabase.from("attendance_punches").insert(
              snapshot.map((p) => ({
                employee_id: employeeId,
                punch_date: date,
                punch_minutes: p.punch_minutes,
                source: p.source,
              })),
            );
          }
          throw insErr;
        }
      }

      setExistingCount(sorted.length);
      await queryClient.invalidateQueries();
      toast.success(
        sorted.length ? `Saved ${sorted.length} punch${sorted.length > 1 ? "es" : ""} for ${date}` : `Cleared all punches for ${date}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save punches");
    } finally {
      setSaving(false);
    }
  };


  const deleteDay = async () => {
    if (!employeeId || !date) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("attendance_punches")
        .delete()
        .eq("employee_id", employeeId)
        .eq("punch_date", date);
      if (error) throw error;
      setRows([newRow()]);
      setExistingCount(0);
      await queryClient.invalidateQueries();
      toast.success(`Deleted all punches for ${date}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete punches");
    } finally {
      setSaving(false);
    }
  };

  // Inactive employees stay in history/reports but are hidden from entry selectors.
  const employees = (employeesQ.data ?? []).filter((e) => e.active || e.id === employeeId);


  return (
    <div>
      <PageHeader
        title="Manual entry"
        description="Add or correct punches for one employee on one date. Every punch is preserved; IN/OUT alternates chronologically."
      />

      {employeesQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : employeesQ.error ? (
        <EmptyState
          title="Could not load employees"
          description={employeesQ.error instanceof Error ? employeesQ.error.message : undefined}
        />
      ) : employees.length === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Import a Petpooja attendance file first — employees are created automatically."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Punches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Employee</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.employee_code} — {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="punch-date">Date</Label>
                  <Input
                    id="punch-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              {!employeeId ? (
                <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Select an employee to load that day's punches.
                </p>
              ) : loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : loadError ? (
                <p className="text-sm text-destructive">{loadError}</p>
              ) : (
                <div className="space-y-2">
                  {parsedRows.map((r, i) => (
                    <div key={r.key} className="flex items-center gap-2">
                      <span className="w-6 shrink-0 text-xs tabular text-muted-foreground">{i + 1}.</span>
                      <Input
                        value={r.value}
                        placeholder="09:15 or 9:15 AM"
                        aria-label={`Punch ${i + 1}`}
                        aria-invalid={!r.empty && r.minutes === null}
                        className="max-w-[180px] tabular"
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((row) => (row.key === r.key ? { ...row, value: e.target.value } : row)),
                          )
                        }
                      />
                      <span className="w-16 shrink-0 text-xs font-medium">
                        {r.empty ? "" : r.minutes === null ? (
                          <span className="text-destructive">invalid</span>
                        ) : (
                          punchType(filled.findIndex((f) => f.key === r.key))
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground tabular">
                        {r.minutes !== null ? minutesToLabel(r.minutes) : ""}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove punch ${i + 1}`}
                        onClick={() =>
                          setRows((prev) => {
                            const next = prev.filter((row) => row.key !== r.key);
                            return next.length ? next : [newRow()];
                          })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Button variant="outline" size="sm" onClick={() => setRows((p) => [...p, newRow()])}>
                    <Plus className="h-4 w-4" /> Add punch
                  </Button>
                </div>
              )}

              {errors.length ? (
                <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button onClick={save} disabled={!canSave}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save punches
                </Button>
                <Button
                  variant="outline"
                  onClick={deleteDay}
                  disabled={!employeeId || saving || existingCount === 0}
                >
                  <Trash2 className="h-4 w-4" /> Delete day
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stored punches</span>
                <span className="tabular font-medium">{existingCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">After save</span>
                <span className="tabular font-medium">{sorted.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">First in</span>
                <span className="tabular font-medium">{minutesToLabel(sorted[0] ?? null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last out</span>
                <span className="tabular font-medium">
                  {sorted.length > 1 ? minutesToLabel(sorted[sorted.length - 1]!) : "—"}
                </span>
              </div>
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                Saving replaces every punch stored for this employee on this date with the list above.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

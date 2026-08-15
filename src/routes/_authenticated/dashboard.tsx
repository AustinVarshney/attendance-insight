import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { AttendanceChart } from "@/components/AttendanceChart";
import { MonthPicker, useMonthState } from "@/components/MonthPicker";
import { EmptyState, StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployees, useMonthPunches } from "@/hooks/useAttendanceData";
import { buildMonthSeries, minutesToLabel, monthLabel, summarize, type Punch } from "@/lib/attendance";
import { exportAllEmployeesPdf } from "@/lib/pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Attendance Graph" },
      { name: "description", content: "Monthly attendance overview, punch coverage and first in / last out trends." },
      { property: "og:title", content: "Dashboard — Attendance Graph" },
      { property: "og:description", content: "Monthly attendance overview across all employees." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { year, month, setYear, setMonth } = useMonthState();
  const employeesQ = useEmployees();
  const punchesQ = useMonthPunches(year, month);
  const [selected, setSelected] = useState<string>("");
  const [dept, setDept] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const allEmployees = employeesQ.data ?? [];
  const departments = useMemo(
    () => Array.from(new Set(allEmployees.map((e) => e.department).filter((d): d is string => !!d))).sort(),
    [allEmployees],
  );
  const employees = useMemo(
    () => (dept === "all" ? allEmployees : allEmployees.filter((e) => (e.department ?? "") === dept)),
    [allEmployees, dept],
  );
  const punches = punchesQ.data ?? [];


  const byEmployee = useMemo(() => {
    const map = new Map<string, Punch[]>();
    for (const p of punches) {
      const list = map.get(p.employee_id) ?? [];
      list.push(p);
      map.set(p.employee_id, list);
    }
    return map;
  }, [punches]);

  const activeId = selected || employees[0]?.id || "";
  const activeEmployee = employees.find((e) => e.id === activeId);
  const series = useMemo(
    () => buildMonthSeries(byEmployee.get(activeId) ?? [], year, month),
    [byEmployee, activeId, year, month],
  );
  const summary = useMemo(() => summarize(series), [series]);

  const overall = useMemo(() => {
    const covered = employees.filter((e) => (byEmployee.get(e.id)?.length ?? 0) > 0).length;
    return { covered, totalPunches: punches.length };
  }, [employees, byEmployee, punches.length]);

  const exportAll = async () => {
    setExporting(true);
    try {
      exportAllEmployeesPdf(employees, byEmployee, year, month);
      toast.success(`Exported ${employees.length} employee pages`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const loading = employeesQ.isLoading || punchesQ.isLoading;
  const error = employeesQ.error ?? punchesQ.error;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Attendance overview for ${monthLabel(year, month)}`}
        actions={
          <>
            <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
            <Button size="sm" onClick={exportAll} disabled={exporting || employees.length === 0}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              All employees PDF
            </Button>
          </>
        }
      />

      {error ? (
        <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>{error instanceof Error ? error.message : "Could not load attendance data."}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Employees" value={employees.length} hint={`${overall.covered} with punches this month`} />
          <StatCard label="Punches recorded" value={overall.totalPunches} hint="All punches preserved" />
          <StatCard label="Present days" value={summary.presentDays} hint={activeEmployee?.name ?? "—"} />
          <StatCard label="Avg first in" value={minutesToLabel(summary.avgFirstIn)} hint={activeEmployee?.name ?? "—"} />
          <StatCard label="Avg last out" value={minutesToLabel(summary.avgLastOut)} hint={activeEmployee?.name ?? "—"} />
        </div>
      )}

      <Card className="mt-5">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Daily first in / last out</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={activeId} onValueChange={setSelected}>
              <SelectTrigger className="h-9 w-[240px]">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.employee_code} · {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeEmployee ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/employees/$id" params={{ id: activeEmployee.id }}>
                  Open detail
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[340px] w-full" />
          ) : employees.length === 0 ? (
            <EmptyState
              title="No employees yet"
              description="Import a Petpooja attendance file to create employees and punches."
              action={
                <Button asChild size="sm">
                  <Link to="/import">Import attendance</Link>
                </Button>
              }
            />
          ) : (
            <AttendanceChart series={series} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { MonthPicker, useMonthState } from "@/components/MonthPicker";
import { EmptyState } from "@/components/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployees, useMonthPunches } from "@/hooks/useAttendanceData";
import { buildMonthSeries, minutesToLabel, monthLabel, summarize, type Punch } from "@/lib/attendance";

export const Route = createFileRoute("/_authenticated/employees/")({
  head: () => ({
    meta: [
      { title: "Employees — Attendance Graph" },
      { name: "description", content: "Browse employees and their monthly attendance coverage." },
      { property: "og:title", content: "Employees — Attendance Graph" },
      { property: "og:description", content: "Browse employees and their monthly attendance coverage." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { year, month, setYear, setMonth } = useMonthState();
  const employeesQ = useEmployees();
  const punchesQ = useMonthPunches(year, month);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");

  const departments = useMemo(
    () =>
      Array.from(new Set((employeesQ.data ?? []).map((e) => e.department).filter((d): d is string => !!d))).sort(),
    [employeesQ.data],
  );


  const byEmployee = useMemo(() => {
    const map = new Map<string, Punch[]>();
    for (const p of punchesQ.data ?? []) {
      const list = map.get(p.employee_id) ?? [];
      list.push(p);
      map.set(p.employee_id, list);
    }
    return map;
  }, [punchesQ.data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (employeesQ.data ?? [])
      .filter(
        (e) =>
          !term ||
          e.name.toLowerCase().includes(term) ||
          e.employee_code.toLowerCase().includes(term) ||
          (e.department ?? "").toLowerCase().includes(term),
      )
      .map((e) => {
        const summary = summarize(buildMonthSeries(byEmployee.get(e.id) ?? [], year, month));
        return { employee: e, summary };
      });
  }, [employeesQ.data, byEmployee, q, year, month]);

  const error = employeesQ.error ?? punchesQ.error;

  return (
    <div>
      <PageHeader
        title="Employees"
        description={`Attendance coverage for ${monthLabel(year, month)}`}
        actions={<MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />}
      />

      {error ? (
        <div className="mb-5 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>{error instanceof Error ? error.message : "Could not load employees."}</div>
        </div>
      ) : null}

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, code or department"
          className="pl-9"
        />
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          {employeesQ.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={q ? "No matching employees" : "No employees yet"}
                description={q ? "Try a different search term." : "Import an attendance file to get started."}
                action={
                  q ? undefined : (
                    <Button asChild size="sm">
                      <Link to="/import">Import attendance</Link>
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Department</TableHead>
                    <TableHead className="hidden lg:table-cell">Designation</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Punches</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Avg in</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Avg out</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ employee: e, summary }) => (
                    <TableRow key={e.id}>
                      <TableCell className="tabular font-medium">{e.employee_code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {e.name}
                          {e.is_demo ? (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Demo data
                            </Badge>
                          ) : null}
                          {!e.active ? <Badge variant="outline" className="text-[10px]">Inactive</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{e.department ?? "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{e.designation ?? "—"}</TableCell>
                      <TableCell className="tabular text-right">{summary.presentDays}</TableCell>
                      <TableCell className="tabular text-right">{summary.totalPunches}</TableCell>
                      <TableCell className="hidden sm:table-cell tabular text-right">{minutesToLabel(summary.avgFirstIn)}</TableCell>
                      <TableCell className="hidden sm:table-cell tabular text-right">{minutesToLabel(summary.avgLastOut)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/employees/$id" params={{ id: e.id }}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

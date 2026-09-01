import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { AttendanceChart } from "@/components/AttendanceChart";
import { MonthPicker, useMonthState } from "@/components/MonthPicker";
import { EmptyState, StatCard, StatusBadge } from "@/components/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployee, useMonthPunches } from "@/hooks/useAttendanceData";
import { buildMonthSeries, minutesToLabel, minutesToWorkedHours, monthLabel, punchType, summarize } from "@/lib/attendance";
import { exportEmployeePdf } from "@/lib/pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/employees/$id")({
  head: () => ({
    meta: [
      { title: "Employee attendance — Attendance Graph" },
      { name: "description", content: "Daily punch detail and first in / last out chart for one employee." },
      { property: "og:title", content: "Employee attendance — Attendance Graph" },
      { property: "og:description", content: "Daily punch detail and first in / last out chart for one employee." },
    ],
  }),
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { year, month, setYear, setMonth } = useMonthState();
  const employeeQ = useEmployee(id);
  const punchesQ = useMonthPunches(year, month, id);

  const openManualEntry = (date: string) => {
    navigate({
      to: "/manual-entry",
      search: {
        employee: id,
        date,
      },
    });
  };

  const series = useMemo(
    () => buildMonthSeries(punchesQ.data ?? [], year, month),
    [punchesQ.data, year, month],
  );
  const summary = useMemo(() => summarize(series), [series]);

  const employee = employeeQ.data;
  const error = employeeQ.error ?? punchesQ.error;

  if (error) {
    return (
      <div>
        <PageHeader title="Employee" />
        <EmptyState
          title="Could not load this employee"
          description={error instanceof Error ? error.message : undefined}
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/employees">Back to employees</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/employees">
          <ArrowLeft className="h-4 w-4" /> Employees
        </Link>
      </Button>
      <PageHeader
        title={employee ? employee.name : "Loading…"}
        description={
          employee
            ? [employee.employee_code, employee.department, employee.designation].filter(Boolean).join(" · ")
            : undefined
        }
        actions={
          <>
            <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
            <Button
              size="sm"
              disabled={!employee}
              onClick={() => {
                if (!employee) return;
                try {
                  exportEmployeePdf(employee, punchesQ.data ?? [], year, month);
                  toast.success("PDF exported");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "PDF export failed");
                }
              }}
            >
              <Download className="h-4 w-4" /> Employee PDF
            </Button>
          </>
        }
      />

      {employee?.is_demo ? (
        <Badge variant="outline" className="mb-4 text-muted-foreground">
          Demo / seed data
        </Badge>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Present days" value={summary.presentDays} />
        <StatCard label="Missing days" value={summary.missingDays} />
        <StatCard label="Avg first in" value={minutesToLabel(summary.avgFirstIn)} />
        <StatCard label="Avg last out" value={minutesToLabel(summary.avgLastOut)} />
        <StatCard label="Total hours worked" value={minutesToWorkedHours(summary.totalWorkedMinutes)} />
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">First in / last out — {monthLabel(year, month)}</CardTitle>
        </CardHeader>
        <CardContent>
          {punchesQ.isLoading 
            ? 
          <Skeleton className="h-[340px] w-full" /> 
            : 
          <AttendanceChart 
            series={series}
            onDayClick={openManualEntry}   
          />}
        </CardContent>
      </Card>

      <Card className="mt-5 py-0">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Date</TableHead>
                  {/* <p className="px-4 py-2 text-xs text-muted-foreground">
                    Click any day to add, edit, or delete punches.
                  </p> */}
                  <TableHead>All punches</TableHead>
                  <TableHead className="w-[110px]">First in</TableHead>
                  <TableHead className="w-[110px]">Last out</TableHead>
                  <TableHead className="w-[120px]">Work duration</TableHead>
                  <TableHead className="w-[60px] text-right">#</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((d) => (
                  <TableRow 
                    key={d.date} 
                    className="cursor-pointer hover:bg-muted/50"
                    title={`Click to edit punches for ${d.date}`}
                    onClick={() => openManualEntry(d.date)}
                  >
                    <TableCell className="tabular">
                      {String(d.day).padStart(2, "0")}{" "}
                      <span className="text-muted-foreground">
                        {new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {d.punches.length ? (
                        <div className="flex flex-wrap gap-1">
                          {d.punches.map((p, i) => (
                            <span
                              key={`${d.date}-${p}-${i}`}
                              className="rounded border border-border px-1.5 py-0.5 text-xs tabular"
                            >
                              {minutesToLabel(p)}
                              <span className="ml-1 text-[10px] text-muted-foreground">{punchType(i)}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular">{minutesToLabel(d.firstIn)}</TableCell>
                    <TableCell className="tabular">{minutesToLabel(d.lastOut)}</TableCell>
                    <TableCell className="tabular">{d.workingMinutes ? minutesToWorkedHours(d.workingMinutes) : "—"}</TableCell>
                    <TableCell className="tabular text-right">{d.total}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

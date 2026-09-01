import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildMonthSeries,
  minutesToLabel,
  minutesToWorkedHours,
  monthLabel,
  summarize,
  type DayRecord,
  type Employee,
  type Punch,
} from "./attendance";

const SLATE = [51, 65, 85] as const;
const MUTED = [100, 116, 139] as const;
const LINE = [203, 213, 225] as const;
const IN_COLOR = [29, 78, 216] as const;
const OUT_COLOR = [180, 83, 9] as const;

function drawChart(doc: jsPDF, series: DayRecord[], x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);

  // Y grid: every 3 hours, 0..24
  for (let hour = 0; hour <= 24; hour += 3) {
    const yy = y + h - (hour / 24) * h;
    doc.line(x, yy, x + w, yy);
    doc.text(`${String(hour).padStart(2, "0")}:00`, x - 2, yy + 1.5, { align: "right" });
  }

  const n = series.length;
  const step = w / Math.max(n - 1, 1);
  const px = (i: number) => x + i * step;
  const py = (m: number) => y + h - (m / 1440) * h;

  series.forEach((d, i) => {
    if (d.day % 2 === 1 || n <= 16) {
      doc.text(String(d.day), px(i), y + h + 4, { align: "center" });
    }
  });

  const drawSeries = (key: "firstIn" | "lastOut", color: readonly [number, number, number]) => {
    doc.setDrawColor(...color);
    doc.setFillColor(...color);
    doc.setLineWidth(0.5);
    let prev: { x: number; y: number } | null = null;
    series.forEach((d, i) => {
      const v = d[key];
      if (v === null) {
        prev = null;
        return;
      }
      const pt = { x: px(i), y: py(v) };
      if (prev) doc.line(prev.x, prev.y, pt.x, pt.y);
      doc.circle(pt.x, pt.y, 0.6, "F");
      prev = pt;
    });
  };
  drawSeries("firstIn", IN_COLOR);
  drawSeries("lastOut", OUT_COLOR);

  // legend
  doc.setFontSize(7);
  doc.setFillColor(...IN_COLOR);
  doc.circle(x + 2, y - 3, 1, "F");
  doc.setTextColor(...SLATE);
  doc.text("First In", x + 5, y - 2);
  doc.setFillColor(...OUT_COLOR);
  doc.circle(x + 22, y - 3, 1, "F");
  doc.text("Last Out", x + 25, y - 2);
}

export function renderEmployeePage(
  doc: jsPDF,
  employee: Employee,
  punches: Punch[],
  year: number,
  month: number,
) {
  const series = buildMonthSeries(punches, year, month);
  const s = summarize(series);
  const M = 14;
  const W = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(employee.name, M, 18);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    [employee.employee_code, employee.department, employee.designation].filter(Boolean).join("  ·  "),
    M,
    24,
  );
  doc.setFontSize(11);
  doc.setTextColor(...SLATE);
  doc.text(`Attendance — ${monthLabel(year, month)}`, W - M, 18, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(employee.active ? "Active" : "Inactive", W - M, 24, { align: "right" });
  doc.setDrawColor(...LINE);
  doc.line(M, 28, W - M, 28);

  const cards: [string, string][] = [
    ["Present days", String(s.presentDays)],
    ["Missing days", String(s.missingDays)],
    ["Avg first in", minutesToLabel(s.avgFirstIn)],
    ["Avg last out", minutesToLabel(s.avgLastOut)],
    ["Total hours worked", minutesToWorkedHours(s.totalWorkedMinutes)],
  ];
  const cw = (W - M * 2) / cards.length;
  cards.forEach(([label, value], i) => {
    const cx = M + i * cw;
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), cx + 2, 35);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(value, cx + 2, 41);
  });

  drawChart(doc, series, M + 12, 52, W - M * 2 - 14, 52);

  const rows = series.map((d) => [
    `${String(d.day).padStart(2, "0")} ${new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}`,
    d.punches.map((p) => minutesToLabel(p)).join(", ") || "—",
    minutesToLabel(d.firstIn),
    minutesToLabel(d.lastOut),
    d.workingMinutes ? minutesToWorkedHours(d.workingMinutes) : "—",
    String(d.total),
    d.status === "present" ? "Present" : d.status === "incomplete" ? "Incomplete" : "Absent",
  ]);

  autoTable(doc, {
    startY: 116,
    head: [["Date", "All punches", "First in", "Last out", "Work duration", "#", "Status"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 6.4, cellPadding: 1.1, lineColor: [226, 232, 240], textColor: [30, 41, 59] },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 57 },
      4: { cellWidth: 22 },
      5: { cellWidth: 8, halign: "center" },
      6: { cellWidth: 20 },
    },
    margin: { left: M, right: M, bottom: 12 },
  });

  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    `Attendance Graph · generated ${new Date().toLocaleString()}`,
    M,
    doc.internal.pageSize.getHeight() - 8,
  );
}

export function exportEmployeePdf(
  employee: Employee,
  punches: Punch[],
  year: number,
  month: number,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  renderEmployeePage(doc, employee, punches, year, month);
  doc.save(`${employee.employee_code}-${year}-${String(month).padStart(2, "0")}.pdf`);
}

export function exportAllEmployeesPdf(
  employees: Employee[],
  punchesByEmployee: Map<string, Punch[]>,
  year: number,
  month: number,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  employees.forEach((e, i) => {
    if (i > 0) doc.addPage();
    renderEmployeePage(doc, e, punchesByEmployee.get(e.id) ?? [], year, month);
  });
  doc.save(`attendance-all-${year}-${String(month).padStart(2, "0")}.pdf`);
}

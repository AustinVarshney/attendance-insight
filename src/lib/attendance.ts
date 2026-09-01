export type Employee = {
  id: string;
  employee_code: string;
  name: string;
  department: string | null;
  designation: string | null;
  active: boolean;
  is_demo: boolean;
};

export type Punch = {
  id: string;
  employee_id: string;
  punch_date: string;
  punch_minutes: number;
  source: string;
};

export type DayRecord = {
  date: string;
  day: number;
  punches: number[];
  firstIn: number | null;
  lastOut: number | null;
  workingMinutes: number;
  total: number;
  status: "present" | "absent" | "incomplete";
};

/** Parse a time-of-day string into minutes since midnight. Returns null if unparseable. */
export function parseTimeToMinutes(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  // Excel time cells arrive as a fraction of a day (0.5 = 12:00 PM)
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const frac = raw % 1;
    if (frac > 0 || (raw > 0 && raw < 1)) {
      const mins = Math.round(frac * 1440) % 1440;
      return mins;
    }
    raw = String(raw);
  }


  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/\./g, ":").replace(/\s+/g, " ");

  const ampmMatch = s.match(/\b(am|pm)\b|(am|pm)$/);
  const ampm = ampmMatch ? (ampmMatch[0] as "am" | "pm") : null;
  s = s.replace(/(am|pm)/g, "").trim();

  let h: number, m: number, sec = 0;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.length >= 2) {
    h = Number(parts[0]);
    m = Number(parts[1]);
    if (parts[2] !== undefined) sec = Number(parts[2]);
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2));
    m = Number(s.slice(-2));
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s);
    m = 0;
  } else {
    return null;
  }

  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec)) return null;
  if (m < 0 || m > 59) return null;

  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
  }
  if (h < 0 || h > 23) return null;
  return h * 60 + m;
}

/** Split a cell that may contain several punches (comma, slash, whitespace or newline separated). */
// export function splitPunchCell(raw: unknown): string[] {
//   if (raw === null || raw === undefined) return [];
//   if (typeof raw === "number") return [String(raw)];
//   const text = String(raw);
//   // Preferred path: pull out every time-like token, whatever separates them.
//   const tokens = text.match(/\d{1,2}\s*[:.]\s*\d{2}(?:\s*[:.]\s*\d{2})?\s*(?:[ap]\.?m\.?)?/gi);
//   if (tokens && tokens.length) return tokens.map((t) => t.trim());
//   return text
//     .split(/[,;/\n|\s]+/)
//     .map((p) => p.trim())
//     .filter((p) => p.length > 0 && !/^(a|abs|absent|-|--|off|wo|h|holiday)$/i.test(p));
// }

/**
 * Split a cell that may contain several punches.
 *
 * Supports:
 *   08:36 AM, 02:24 PM, 05:50 PM
 *   08:36 AM 02:24 PM
 *   08:36 AM02:24 PM05:50 PM10:30 PM
 *   08:36
 *   08:36, 10:30
 */
export function splitPunchCell(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];

  if (typeof raw === "number") {
    return [String(raw)];
  }

  const text = String(raw).trim();

  if (!text) return [];

  // First, extract complete 12-hour time values.
  //
  // This intentionally does NOT require a separator between
  // one time and the next.
  //
  // Example:
  // 08:36 AM02:24 PM05:50 PM10:30 PM
  //
  // becomes:
  // ["08:36 AM", "02:24 PM", "05:50 PM", "10:30 PM"]
  const timeTokens = text.match(
    /\d{1,2}\s*[:.]\s*\d{2}(?:\s*[:.]\s*\d{2})?\s*(?:AM|PM|am|pm)?/g
  );

  if (timeTokens && timeTokens.length > 0) {
    return timeTokens.map((token) => token.trim());
  }

  // Fallback for values separated by commas, slashes,
  // spaces, newlines, etc.
  return text
    .split(/[,;/\n|]+/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !/^(a|abs|absent|-|--|off|wo|h|holiday)$/i.test(p)
    );
}

export function minutesToLabel(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "—";
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function minutesToHm(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "—";
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** Format a duration in minutes for the monthly worked-hours summary. */
export function minutesToWorkedHours(mins: number): string {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function punchType(index: number): "IN" | "OUT" {
  return index % 2 === 0 ? "IN" : "OUT";
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function buildMonthSeries(punches: Punch[], year: number, month: number): DayRecord[] {
  const byDate = new Map<string, number[]>();
  for (const p of punches) {
    const list = byDate.get(p.punch_date) ?? [];
    list.push(p.punch_minutes);
    byDate.set(p.punch_date, list);
  }
  const out: DayRecord[] = [];
  const total = daysInMonth(year, month);
  for (let d = 1; d <= total; d++) {
    const date = isoDate(year, month, d);
    const list = (byDate.get(date) ?? []).slice().sort((a, b) => a - b);
    const workingMinutes = list.reduce(
      (sum, punch, index) =>
        index % 2 === 1 && punch > list[index - 1]! ? sum + punch - list[index - 1]! : sum,
      0,
    );
    const status: DayRecord["status"] =
      list.length === 0 ? "absent" : list.length % 2 === 1 ? "incomplete" : "present";
    out.push({
      date,
      day: d,
      punches: list,
      firstIn: list.length ? list[0]! : null,
      lastOut:
        list.length > 1 && list.length % 2 === 0 && list[list.length - 1]! > list[list.length - 2]!
          ? list[list.length - 1]!
          : null,
      workingMinutes,
      total: list.length,
      status,
    });
  }
  return out;
}

export type MonthSummary = {
  presentDays: number;
  missingDays: number;
  avgFirstIn: number | null;
  avgLastOut: number | null;
  totalPunches: number;
  totalWorkedMinutes: number;
};

export function summarize(series: DayRecord[]): MonthSummary {
  const present = series.filter((d) => d.total > 0);
  const ins = present.map((d) => d.firstIn!).filter((v) => v !== null);
  const outs = present.map((d) => d.lastOut).filter((v): v is number => v !== null);
  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  return {
    presentDays: present.length,
    missingDays: series.length - present.length,
    avgFirstIn: avg(ins),
    avgLastOut: avg(outs),
    totalPunches: series.reduce((a, d) => a + d.total, 0),
    totalWorkedMinutes: series.reduce((total, d) => total + d.workingMinutes, 0),
  };
}

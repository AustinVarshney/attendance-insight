import { parseTimeToMinutes, splitPunchCell, isoDate } from "./attendance";

export type Cell = string | number | boolean | Date | null | undefined;
export type Sheet = Cell[][];

export type ParseMessage = { level: "error" | "warning"; message: string };

export type ColumnMapping = {
  mode: "wide" | "normalized";
  headerRowIndex: number;
  codeCol: number;
  nameCol: number | null;
  deptCol: number | null;
  desigCol: number | null;
  /** wide mode: column index -> ISO date */
  dateCols: { index: number; date: string; label: string }[];
  /** normalized mode */
  dateCol: number | null;
  timeCol: number | null;
};

export type ParsedEmployee = {
  employee_code: string;
  name: string;
  department: string | null;
  designation: string | null;
};

export type ParsedPunch = { employee_code: string; date: string; minutes: number };

export type ParseResult = {
  mapping: ColumnMapping;
  employees: ParsedEmployee[];
  punches: ParsedPunch[];
  messages: ParseMessage[];
  periodStart: string | null;
  periodEnd: string | null;
};

const norm = (c: Cell) =>
  (c === null || c === undefined ? "" : String(c)).replace(/\s+/g, " ").trim().toLowerCase();

const CODE_KEYS = ["employee id", "employee code", "emp id", "emp code", "employeeid", "id", "code", "staff id"];
const NAME_KEYS = ["employee name", "name", "emp name", "staff name"];
const DEPT_KEYS = ["department", "dept"];
const DESIG_KEYS = ["designation", "role", "position", "job title"];
const DATE_KEYS = ["date", "attendance date", "punch date"];
const TIME_KEYS = ["punch time", "time", "punch", "punch_time"];

function findCol(header: Cell[], keys: string[], exclude: number[] = []): number | null {
  for (let i = 0; i < header.length; i++) {
    if (exclude.includes(i)) continue;
    const h = norm(header[i]);
    if (!h) continue;
    if (keys.some((k) => h === k)) return i;
  }
  for (let i = 0; i < header.length; i++) {
    if (exclude.includes(i)) continue;
    const h = norm(header[i]);
    if (!h) continue;
    if (keys.some((k) => h.includes(k))) return i;
  }
  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Interpret a wide-format date column header. */
export function parseDateHeader(cell: Cell, fbYear: number, fbMonth: number): string | null {
  if (cell === null || cell === undefined || cell === "") return null;
  if (cell instanceof Date && !isNaN(cell.getTime())) {
    return isoDate(cell.getFullYear(), cell.getMonth() + 1, cell.getDate());
  }
  // Strip weekday words and any trailing descriptive text, keep the date token.
  const s = String(cell).trim();
  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const yr = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
    const a = Number(m[1]);
    const b = Number(m[2]);
    // prefer DD/MM, fall back to MM/DD when impossible
    return a > 12 || b <= 12 ? isoDate(yr, b, a) : isoDate(yr, a, b);
  }
  m = s.match(/^(\d{1,2})[\s-]*([a-z]{3,})/i);
  if (m) {
    const mi = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase());
    if (mi >= 0) return isoDate(fbYear, mi + 1, Number(m[1]));
  }
  m = s.match(/^([a-z]{3,})[\s-]*(\d{1,2})/i);
  if (m) {
    const mi = MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase());
    if (mi >= 0) return isoDate(fbYear, mi + 1, Number(m[2]));
  }
  m = s.match(/^(\d{1,2})$/);
  if (m) {
    const d = Number(m[1]);
    if (d >= 1 && d <= 31) return isoDate(fbYear, fbMonth, d);
  }
  return null;
}


/** Heuristically find the header row and infer a column mapping. */
export function detectMapping(sheet: Sheet, fbYear: number, fbMonth: number): ColumnMapping {
  let best: { score: number; index: number } = { score: -1, index: 0 };
  const limit = Math.min(sheet.length, 25);
  for (let i = 0; i < limit; i++) {
    const row = sheet[i] ?? [];
    const filled = row.filter((c) => norm(c)).length;
    if (filled < 2) continue;
    let score = filled;
    if (findCol(row, CODE_KEYS) !== null) score += 25;
    if (findCol(row, NAME_KEYS) !== null) score += 15;
    if (findCol(row, TIME_KEYS) !== null) score += 10;
    const dateish = row.filter((c) => parseDateHeader(c, fbYear, fbMonth) !== null).length;
    score += dateish * 2;
    if (score > best.score) best = { score, index: i };
  }

  const header = sheet[best.index] ?? [];
  const codeCol = findCol(header, CODE_KEYS) ?? 0;
  const nameCol = findCol(header, NAME_KEYS, [codeCol]);
  const deptCol = findCol(header, DEPT_KEYS, [codeCol]);
  const desigCol = findCol(header, DESIG_KEYS, [codeCol]);
  const dateCol = findCol(header, DATE_KEYS, [codeCol]);
  const timeCol = findCol(header, TIME_KEYS, [codeCol, dateCol ?? -1]);

  const meta = new Set([codeCol, nameCol, deptCol, desigCol].filter((v): v is number => v !== null));
  const dateCols: ColumnMapping["dateCols"] = [];
  for (let i = 0; i < header.length; i++) {
    if (meta.has(i)) continue;
    const d = parseDateHeader(header[i]!, fbYear, fbMonth);
    if (d) dateCols.push({ index: i, date: d, label: String(header[i] ?? "") });
  }

  const mode: ColumnMapping["mode"] =
    dateCols.length >= 3 ? "wide" : dateCol !== null && timeCol !== null ? "normalized" : "wide";

  return {
    mode,
    headerRowIndex: best.index,
    codeCol,
    nameCol,
    deptCol,
    desigCol,
    dateCols,
    dateCol,
    timeCol,
  };
}

function cellText(c: Cell): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString();
  return String(c).trim();
}

export function parseSheet(
  sheet: Sheet,
  mapping: ColumnMapping,
  fbYear: number,
  fbMonth: number,
): ParseResult {
  const messages: ParseMessage[] = [];
  const employees = new Map<string, ParsedEmployee>();
  const punchKeys = new Set<string>();
  const punches: ParsedPunch[] = [];

  const addPunch = (code: string, date: string, minutes: number) => {
    const key = `${code}|${date}|${minutes}`;
    if (punchKeys.has(key)) return false;
    punchKeys.add(key);
    punches.push({ employee_code: code, date, minutes });
    return true;
  };

  const upsertEmp = (code: string, row: Cell[]) => {
    const name = mapping.nameCol !== null ? cellText(row[mapping.nameCol]) : "";
    const dept = mapping.deptCol !== null ? cellText(row[mapping.deptCol]) : "";
    const desig = mapping.desigCol !== null ? cellText(row[mapping.desigCol]) : "";
    const existing = employees.get(code);
    employees.set(code, {
      employee_code: code,
      name: name || existing?.name || code,
      department: dept || existing?.department || null,
      designation: desig || existing?.designation || null,
    });
  };

  for (let r = mapping.headerRowIndex + 1; r < sheet.length; r++) {
    const row = sheet[r] ?? [];
    if (row.every((c) => !cellText(c))) continue;
    const code = cellText(row[mapping.codeCol]);
    if (!code) {
      messages.push({ level: "warning", message: `Row ${r + 1}: missing employee ID — row skipped.` });
      continue;
    }
    if (/employee|total|grand/i.test(code) && r === mapping.headerRowIndex + 1) continue;
    upsertEmp(code, row);

    if (mapping.mode === "wide") {
      for (const dc of mapping.dateCols) {
        const raw = row[dc.index];
        const tokens = splitPunchCell(raw instanceof Date ? raw.toISOString() : raw);
        for (const token of tokens) {
          const mins = parseTimeToMinutes(token);
          if (mins === null) {
            messages.push({
              level: "warning",
              message: `Row ${r + 1} (${code}, ${dc.date}): could not read time "${token}" — skipped.`,
            });
            continue;
          }
          addPunch(code, dc.date, mins);
        }
      }
    } else {
      const dateRaw = mapping.dateCol !== null ? row[mapping.dateCol] : null;
      const date = parseDateHeader(dateRaw ?? null, fbYear, fbMonth);
      if (!date) {
        messages.push({
          level: "error",
          message: `Row ${r + 1} (${code}): unreadable date "${cellText(dateRaw)}".`,
        });
        continue;
      }
      const tokens = splitPunchCell(mapping.timeCol !== null ? row[mapping.timeCol] : null);
      if (tokens.length === 0) {
        messages.push({ level: "warning", message: `Row ${r + 1} (${code}, ${date}): no punch time.` });
      }
      for (const token of tokens) {
        const mins = parseTimeToMinutes(token);
        if (mins === null) {
          messages.push({
            level: "warning",
            message: `Row ${r + 1} (${code}, ${date}): could not read time "${token}" — skipped.`,
          });
          continue;
        }
        addPunch(code, date, mins);
      }
    }
  }

  const dates = punches.map((p) => p.date).sort();
  if (punches.length === 0) {
    messages.push({
      level: "error",
      message: "No punch times were found. Check the column mapping and the selected month.",
    });
  }

  return {
    mapping,
    employees: [...employees.values()],
    punches,
    messages,
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
  };
}

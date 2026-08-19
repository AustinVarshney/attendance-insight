import { supabase } from "@/integrations/supabase/client";
import type { ParseResult } from "./parser";

export type CommitResult = {
  batchId: string;
  employeesCreated: number;
  employeesUpdated: number;
  punchesInserted: number;
  punchesSkipped: number;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Persists a parsed file to the database.
 * - Employees are upserted on employee_code (never duplicated).
 * - Punches are inserted with ignoreDuplicates against the
 *   (employee_id, punch_date, punch_minutes) unique index, so re-importing
 *   the same file is safe and never loses or duplicates punches.
 */
export async function commitImport(
  parsed: ParseResult,
  fileName: string,
  totalRows: number,
): Promise<CommitResult> {
  const codes = parsed.employees.map((e) => e.employee_code);

  const { data: existing, error: exErr } = await supabase
    .from("employees")
    .select("id, employee_code")
    .in("employee_code", codes.length ? codes : ["__none__"]);
  if (exErr) throw exErr;

  const existingCodes = new Set((existing ?? []).map((e) => e.employee_code));

  const { data: upserted, error: upErr } = await supabase
    .from("employees")
    .upsert(
      parsed.employees.map((e) => ({
        id: e.employee_code,
        employee_code: e.employee_code,
        name: e.name,
        department: e.department,
        designation: e.designation,
      })),
      { onConflict: "employee_code" },
    )
    .select("id, employee_code");
  if (upErr) throw upErr;

  const idByCode = new Map((upserted ?? []).map((e) => [e.employee_code, e.id]));

  const { data: batch, error: batchErr } = await supabase
    .from("import_batches")
    .insert({
      file_name: fileName,
      file_format: parsed.mapping.mode,
      status: "processing",
      total_rows: totalRows,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      messages: parsed.messages,
      error_count: parsed.messages.filter((m) => m.level === "error").length,
      warning_count: parsed.messages.filter((m) => m.level === "warning").length,
    })
    .select("id")
    .single();
  if (batchErr) throw batchErr;

  const rows = parsed.punches
    .map((p) => {
      const employee_id = idByCode.get(p.employee_code);
      if (!employee_id) return null;
      return {
        employee_id,
        punch_date: p.date,
        punch_minutes: p.minutes,
        source: "import",
        import_batch_id: batch.id,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  let inserted = 0;
  try {
    for (const part of chunk(rows, 500)) {
      const { data, error } = await supabase
        .from("attendance_punches")
        .upsert(part, {
          onConflict: "employee_id,punch_date,punch_minutes",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) throw error;
      inserted += data?.length ?? 0;
    }
  } catch (err) {
    // Never leave a batch stuck in "processing".
    await supabase
      .from("import_batches")
      .update({
        status: "failed",
        punches_inserted: inserted,
        error_count: parsed.messages.filter((m) => m.level === "error").length + 1,
        messages: [
          ...parsed.messages,
          { level: "error", message: err instanceof Error ? err.message : "Import failed while saving punches." },
        ],
      })
      .eq("id", batch.id);
    throw err;
  }


  const employeesCreated = parsed.employees.filter((e) => !existingCodes.has(e.employee_code)).length;
  const result: CommitResult = {
    batchId: batch.id,
    employeesCreated,
    employeesUpdated: parsed.employees.length - employeesCreated,
    punchesInserted: inserted,
    punchesSkipped: rows.length - inserted,
  };

  const { error: finErr } = await supabase
    .from("import_batches")
    .update({
      status: "completed",
      employees_created: result.employeesCreated,
      employees_updated: result.employeesUpdated,
      punches_inserted: result.punchesInserted,
      punches_skipped: result.punchesSkipped,
    })
    .eq("id", batch.id);
  if (finErr) throw finErr;

  return result;
}

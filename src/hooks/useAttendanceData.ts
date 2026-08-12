import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { daysInMonth, isoDate, type Employee, type Punch } from "@/lib/attendance";

export function monthRange(year: number, month: number) {
  return { start: isoDate(year, month, 1), end: isoDate(year, month, daysInMonth(year, month)) };
}

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_code, name, department, designation, active, is_demo")
        .order("employee_code");
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ["employee", id],
    queryFn: async (): Promise<Employee> => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_code, name, department, designation, active, is_demo")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Employee not found");
      return data as Employee;
    },
  });
}

/** All punches for a month, optionally for one employee. */
export function useMonthPunches(year: number, month: number, employeeId?: string) {
  const { start, end } = monthRange(year, month);
  return useQuery({
    queryKey: ["punches", year, month, employeeId ?? "all"],
    queryFn: async (): Promise<Punch[]> => {
      let q = supabase
        .from("attendance_punches")
        .select("id, employee_id, punch_date, punch_minutes, source")
        .gte("punch_date", start)
        .lte("punch_date", end)
        .order("punch_date")
        .order("punch_minutes")
        .limit(50000);
      if (employeeId) q = q.eq("employee_id", employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Punch[];
    },
  });
}

export function useImportBatches() {
  return useQuery({
    queryKey: ["import-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

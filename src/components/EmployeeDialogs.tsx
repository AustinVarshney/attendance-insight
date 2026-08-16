import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/lib/attendance";

type FormState = {
  employee_code: string;
  name: string;
  department: string;
  designation: string;
  active: boolean;
};

const empty: FormState = { employee_code: "", name: "", department: "", designation: "", active: true };

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: Employee | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      employee
        ? {
            employee_code: employee.employee_code,
            name: employee.name,
            department: employee.department ?? "",
            designation: employee.designation ?? "",
            active: employee.active,
          }
        : empty,
    );
  }, [open, employee]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    const next: Partial<Record<keyof FormState, string>> = {};
    const code = form.employee_code.trim();
    const name = form.name.trim();
    if (!code) next.employee_code = "Employee code is required.";
    if (!name) next.name = "Name is required.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const payload = {
        employee_code: code,
        name,
        department: form.department.trim() || null,
        designation: form.designation.trim() || null,
        active: form.active,
      };

      // Duplicate code guard (case-insensitive) before hitting the unique index.
      const dupQ = supabase.from("employees").select("id").ilike("employee_code", code).limit(1);
      const { data: dup, error: dupErr } = await dupQ;
      if (dupErr) throw dupErr;
      if (dup?.length && dup[0]!.id !== employee?.id) {
        setErrors({ employee_code: "An employee with this code already exists." });
        setSaving(false);
        return;
      }

      if (employee) {
        const { error } = await supabase.from("employees").update(payload).eq("id", employee.id);
        if (error) throw error;
        toast.success(`${name} updated`);
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) {
          if (error.code === "23505") {
            setErrors({ employee_code: "An employee with this code already exists." });
            return;
          }
          throw error;
        }
        toast.success(`${name} added`);
      }
      await queryClient.invalidateQueries();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {employee
              ? "Changes apply everywhere attendance for this employee is shown."
              : "Create an employee record so punches can be imported or entered manually."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="emp-code">Employee ID / code *</Label>
            <Input
              id="emp-code"
              value={form.employee_code}
              onChange={(e) => set("employee_code", e.target.value)}
              placeholder="EMP001"
            />
            {errors.employee_code ? <p className="text-xs text-destructive">{errors.employee_code}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Name *</Label>
            <Input id="emp-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Input id="emp-dept" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="Kitchen" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-desig">Designation</Label>
            <Input
              id="emp-desig"
              value={form.designation}
              onChange={(e) => set("designation", e.target.value)}
              placeholder="Chef"
            />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="emp-active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive employees stay in history and reports but are hidden from entry selectors.
              </p>
            </div>
            <Switch id="emp-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {employee ? "Save changes" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeDeleteDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: Employee | null;
}) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !employee) return;
    setCount(null);
    void (async () => {
      const { count: c, error } = await supabase
        .from("attendance_punches")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employee.id);
      setCount(error ? 0 : (c ?? 0));
    })();
  }, [open, employee]);

  async function deactivate() {
    if (!employee) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("employees").update({ active: false }).eq("id", employee.id);
      if (error) throw error;
      toast.success(`${employee.name} deactivated`);
      await queryClient.invalidateQueries();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not deactivate employee.");
    } finally {
      setBusy(false);
    }
  }

  async function hardDelete() {
    if (!employee) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("employees").delete().eq("id", employee.id);
      if (error) throw error;
      toast.success(`${employee.name} deleted`);
      await queryClient.invalidateQueries();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete employee.");
    } finally {
      setBusy(false);
    }
  }

  const hasPunches = (count ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {employee?.name}?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {count === null ? (
                <p>Checking attendance records…</p>
              ) : hasPunches ? (
                <>
                  <p>
                    This employee has <span className="font-medium text-foreground">{count}</span> attendance punches.
                    Deleting them would destroy that history, so only deactivation is available.
                  </p>
                  <p>
                    Deactivating keeps every punch, dashboard figure and report intact, and hides the employee from
                    attendance-entry selectors.
                  </p>
                </>
              ) : (
                <p>
                  This employee has no attendance records, so they can be permanently deleted. You can also just
                  deactivate them to keep the record.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {employee?.active !== false ? (
            <Button variant="secondary" onClick={() => void deactivate()} disabled={busy || count === null}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Deactivate
            </Button>
          ) : null}
          {count !== null && !hasPunches ? (
            <Button variant="destructive" onClick={() => void hardDelete()} disabled={busy}>
              Delete permanently
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

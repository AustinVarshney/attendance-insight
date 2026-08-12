
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text NOT NULL UNIQUE,
  name text NOT NULL,
  department text,
  designation text,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_format text NOT NULL DEFAULT 'wide',
  status text NOT NULL DEFAULT 'completed',
  total_rows integer NOT NULL DEFAULT 0,
  employees_created integer NOT NULL DEFAULT 0,
  employees_updated integer NOT NULL DEFAULT 0,
  punches_inserted integer NOT NULL DEFAULT 0,
  punches_skipped integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  period_start date,
  period_end date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  punch_date date NOT NULL,
  punch_minutes integer NOT NULL CHECK (punch_minutes >= 0 AND punch_minutes < 1440),
  source text NOT NULL DEFAULT 'manual',
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_punches_unique UNIQUE (employee_id, punch_date, punch_minutes)
);

CREATE INDEX idx_punches_employee_date ON public.attendance_punches (employee_id, punch_date);
CREATE INDEX idx_punches_date ON public.attendance_punches (punch_date);
CREATE INDEX idx_employees_department ON public.employees (department);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_punches TO authenticated;
GRANT ALL ON public.attendance_punches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users manage employees" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users manage punches" ON public.attendance_punches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in users manage import batches" ON public.import_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.employees (employee_code, name, department, designation, active, is_demo) VALUES
('EMP001','Rahul Sharma','Kitchen','Head Chef',true,true),
('EMP002','Priya Menon','Service','Floor Manager',true,true),
('EMP003','Arjun Nair','Kitchen','Sous Chef',true,true),
('EMP004','Sneha Patel','Front Desk','Cashier',true,true),
('EMP005','Vikram Singh','Service','Steward',true,true),
('EMP006','Ananya Rao','Housekeeping','Supervisor',true,true),
('EMP007','Imran Qureshi','Kitchen','Commis',true,true),
('EMP008','Meera Joshi','Administration','HR Executive',true,true),
('EMP009','Karthik Iyer','Service','Steward',false,true),
('EMP010','Divya Kapoor','Front Desk','Host',true,true);

INSERT INTO public.import_batches (file_name, file_format, status, total_rows, employees_created, punches_inserted, period_start, period_end)
VALUES ('demo-seed-attendance.xlsx','wide','completed',10,10,0,date_trunc('month', now())::date,(date_trunc('month', now()) + interval '1 month - 1 day')::date);

INSERT INTO public.attendance_punches (employee_id, punch_date, punch_minutes, source)
SELECT e.id, d::date,
  m.base + (abs(hashtext(e.employee_code || d::text || m.idx::text)) % 25),
  'demo'
FROM public.employees e
CROSS JOIN generate_series(date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date, interval '1 day') d
CROSS JOIN (VALUES (0,535),(1,775),(2,820),(3,1145)) AS m(idx, base)
WHERE e.is_demo
  AND e.active
  AND extract(dow from d) <> 0
  AND d::date <= current_date
  AND (abs(hashtext(e.employee_code || d::text)) % 11) <> 0
ON CONFLICT DO NOTHING;

UPDATE public.import_batches SET punches_inserted = (SELECT count(*) FROM public.attendance_punches);

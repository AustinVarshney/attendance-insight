DELETE FROM public.attendance_punches WHERE employee_id IN (SELECT id FROM public.employees WHERE employee_code IN ('EMP900','EMP901'));
DELETE FROM public.import_batches WHERE file_name IN ('wide.xlsx','norm.xlsx');
DELETE FROM public.employees WHERE employee_code IN ('EMP900','EMP901');
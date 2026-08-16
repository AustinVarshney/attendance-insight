# Attendance Insight

Build a complete production-quality internal web application called "Attendance Graph" for managing monthly employee punch attendance imported from Petpooja Excel/CSV exports. Build the actual full-stack application, not a mockup.

Use this source-file behavior as the import reference: Petpooja can export a wide spreadsheet where each employee is a row with employee ID/name/department/designation and one column per date; a date cell may contain multiple comma-separated punch timestamps such as "12:00 PM, 04:21 PM, 04:35 PM, 10:10 PM". Real files may contain a complete month. Also support a normalized future format with Employee ID, Date, Punch Time.

Core requirements:
1. Dashboard with month/year selector, employee search/filter, department filter, summary cards, and clean professional internal-business UI.
2. Employees: employee ID/code, name, department, designation, active status. Employee records reusable across imports.
3. Attendance data model preserves EVERY punch timestamp for each employee/date. Sequential punches are classified IN, OUT, IN, OUT. Main visualization uses First IN and Last OUT; detailed punches remain available.
4. Main employee monthly chart: X-axis every calendar day of selected month; Y-axis full 24-hour day from 00:00 through 24:00. Two clear lines: First In and Last Out. Missing days remain visible with null points. Hover shows date, first in, last out, total punches. Make 28-31 days readable.
5. Employee detail page: employee header, month selector, monthly First IN/Last OUT line chart, summary (present days, missing days, average first-in, average last-out, total punches), and detailed daily punch table showing date, all punches chronologically, first in, last out, total punches, status.
6. Manual attendance entry/editing: select employee/date, dynamically add multiple punch times, validate chronological order, auto-classify alternately IN/OUT, edit/delete individual punches, save to database.
7. Excel/CSV import: upload Petpooja wide exports, parse employee metadata/date columns, support cells with multiple comma-separated punch times, normalize 12-hour/24-hour time formats, validate, preview before commit, show errors/warnings, prevent duplicate punches, import summary new/updated/skipped/error, and import history. Re-importing the same file must not create duplicates. Also support normalized Employee ID/Date/Punch Time files. Include a column/format mapping step when needed.
8. PDF export: one employee's selected-month report as a polished single-page PDF containing employee details, summary, monthly chart, and compact daily punch summary. Also Download All Employees as multi-page PDF, one employee per page.
9. PostgreSQL/Supabase persistence with relational tables employees, attendance_punches, import_batches and appropriate indexes/unique constraints. Safe upserts.
10. Authentication-ready structure. If Supabase auth is available, provide a simple sign-in screen and protect app routes; otherwise keep it cleanly structured for later auth.
11. Responsive desktop-first design.
12. Strong loading, empty, error, validation, import progress, success states.
13. Include realistic demo/sample attendance data so the UI is immediately understandable, clearly labeled demo data if needed.
14. Navigation: Dashboard, Employees, Import Attendance, Manual Entry, Import History. Employee detail reachable from Employees/dashboard.
15. Use TypeScript, Tailwind CSS, shadcn/ui, Recharts for charts, SheetJS/xlsx for spreadsheets, jsPDF/html2canvas or another robust client-side PDF approach compatible with the project.
16. Convert time-of-day to minutes since midnight internally; display human-readable time labels/tooltips. Fixed chart Y range 0-24 hours. Clear First In/Last Out legend.
17. Main chart semantics: first punch of day = First In, final punch = Last Out; all punches are preserved for detailed reporting.
18. Add import preview and configurable/tolerant parser rather than hard-coding one exact Petpooja layout.
19. Include export controls and clear month/employee context everywhere.
20. Add useful duplicate protection using employee/date/time uniqueness. Track import batch metadata.

Suggested UI:
- Professional HR/attendance analytics tool, clean white/slate interface, restrained accent, excellent typography, subtle borders/cards, compact readable tables, status badges.
- Avoid flashy gradients, excessive rounded cards, marketing landing-page style, and unnecessary animation.
- Dashboard should feel like a real company internal tool.
- Employee monthly page should prominently show the graph and then the detailed punch table.
- PDF should be print-friendly and fit one employee per page.

Build database schema, migrations, UI, parser, import preview, persistence, charting, manual entry, PDF export, demo data, and routing now. Make reasonable implementation decisions without asking me follow-up questions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/deeb4858-c582-48ed-9d0f-8b448f7c4818).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

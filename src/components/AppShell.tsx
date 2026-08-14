import { Link, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, Users, Upload, PencilLine, History, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/import", label: "Import Attendance", icon: Upload },
  { to: "/manual-entry", label: "Manual Entry", icon: PencilLine },
  { to: "/import-history", label: "Import History", icon: History },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
              AG
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Attendance Graph</div>
              <div className="text-[11px] leading-tight text-muted-foreground">Internal HR tool</div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
                activeOptions={{ exact: to === "/dashboard" }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-border p-2">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2.5" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:hidden">
            <span className="text-sm font-semibold">Attendance Graph</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1.5 lg:hidden">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="whitespace-nowrap rounded px-2.5 py-1.5 text-xs text-muted-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

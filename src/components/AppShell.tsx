import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-ink-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-semibold">Classe Viva</span>
              <span className="block truncate text-xs text-muted-foreground">
                {role === "teacher" ? "Professor" : "Aluno"} · {profile?.name}
              </span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        <div className="mb-6 animate-rise">
          <h1 className="text-balance-tight text-2xl font-semibold sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Role } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Classe Viva — Gamificação Escolar" },
      {
        name: "description",
        content:
          "Acesse a Classe Viva como professor ou aluno para lançar pontos, responder quizzes e acompanhar o ranking da turma.",
      },
      { property: "og:title", content: "Entrar · Classe Viva" },
      {
        property: "og:description",
        content: "Login e cadastro da plataforma de gamificação e presença da sua turma.",
      },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  name: z.string().trim().max(80, "Nome muito longo").optional(),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha precisa de pelo menos 6 caracteres").max(72),
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { session, role: currentRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session && !loading && currentRole) {
      navigate({ to: currentRole === "teacher" ? "/professor" : "/aluno", replace: true });
    }
  }, [session, loading, currentRole, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { name: parsed.data.name || parsed.data.email.split("@")[0], role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Cadastro criado! Confirme seu e-mail para entrar.");
          setMode("login");
        } else {
          toast.success("Bem-vindo(a)! Conta criada com sucesso.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível continuar";
      toast.error(
        message.includes("Invalid login credentials")
          ? "E-mail ou senha incorretos."
          : message.includes("already registered")
            ? "Este e-mail já tem conta. Faça login."
            : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-ink-foreground lg:flex">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-96 animate-shine rounded-full bg-gold/25 blur-3xl"
        />
        <Link to="/" className="relative flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles className="size-5 text-gold" /> Classe Viva
        </Link>
        <div className="relative max-w-sm">
          <h2 className="text-balance-tight text-3xl font-semibold leading-tight">
            Presença que vale ponto. Aula que vira conquista.
          </h2>
          <p className="mt-4 text-sm text-ink-foreground/70">
            Chamada em um clique, quizzes interativos e um extrato transparente de pontos para cada
            aluno da turma.
          </p>
        </div>
        <p className="relative text-xs text-ink-foreground/50">
          Professor lança · Aluno acompanha · Todos evoluem
        </p>
      </aside>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <span className="grid size-11 place-items-center rounded-2xl bg-ink text-ink-foreground">
              <Sparkles className="size-5" />
            </span>
          </div>
          <h1 className="text-2xl font-semibold">
            {mode === "login" ? "Entrar na turma" : "Criar sua conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Use seu e-mail e senha para continuar."
              : "Escolha seu perfil e comece a pontuar."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === "signup" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: "student", label: "Aluno", icon: UserRound },
                      { value: "teacher", label: "Professor", icon: GraduationCap },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                        role === option.value
                          ? "border-primary bg-accent shadow-soft"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <option.icon
                        className={`size-5 ${role === option.value ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como aparecerá na lista"
                    maxLength={80}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@escola.com"
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                maxLength={72}
              />
            </div>

            <Button type="submit" variant="ink" className="h-11 w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Cadastre-se" : "Fazer login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

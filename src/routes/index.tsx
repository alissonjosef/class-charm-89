import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCircle2, ClipboardList, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { RULES } from "@/lib/points";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Classe Viva — Gamificação escolar e presença" },
      {
        name: "description",
        content:
          "Plataforma de gamificação escolar: chamada em um clique, pontos por presença e material, quizzes interativos e ranking da turma.",
      },
      { property: "og:title", content: "Classe Viva — Gamificação escolar e presença" },
      {
        property: "og:description",
        content:
          "Professores lançam pontos em um clique. Alunos acompanham saldo, nível e respondem quizzes.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session && !loading && role) {
      navigate({ to: role === "teacher" ? "/professor" : "/aluno", replace: true });
    }
  }, [session, loading, role, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2 font-display font-semibold">
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-ink-foreground">
            <Sparkles className="size-4" />
          </span>
          Classe Viva
        </span>
        <Button asChild variant="soft" size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-14 pt-8 sm:pt-16">
        <div className="max-w-2xl animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Trophy className="size-3.5 text-gold" /> Presença, material e conquistas
          </span>
          <h1 className="mt-5 text-balance-tight text-4xl font-semibold leading-[1.08] sm:text-5xl">
            A sua turma, com pontos que fazem sentido.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            O professor faz a chamada e lança pontos em um clique. O aluno vê o saldo, o nível, o
            extrato completo e responde os quizzes da semana pelo celular.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="ink" size="lg">
              <Link to="/auth">Começar agora</Link>
            </Button>
            <Button asChild variant="soft" size="lg">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: CheckCircle2,
              title: "Chamada gamificada",
              text: "Presença, pontualidade, Bíblia e revista — cada ação vale pontos, lançados com um toque.",
            },
            {
              icon: ClipboardList,
              title: "Quizzes com prazo",
              text: "Crie perguntas de múltipla escolha, defina a pontuação e acompanhe as respostas.",
            },
            {
              icon: Trophy,
              title: "Níveis e badges",
              text: "Do Iniciante ao Diamante, com extrato transparente de tudo que ganhou ou perdeu.",
            },
          ].map((card) => (
            <article key={card.title} className="surface animate-pop-in p-5">
              <card.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-base font-semibold">{card.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{card.text}</p>
            </article>
          ))}
        </div>

        <div className="surface mt-6 overflow-hidden p-5">
          <h2 className="font-display text-base font-semibold">Tabela de pontuação da sala</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {RULES.map((rule) => (
              <span
                key={rule.key}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs"
              >
                {rule.label}
                <b className={rule.points >= 0 ? "text-success" : "text-destructive"}>
                  {rule.points > 0 ? "+" : ""}
                  {rule.points}
                </b>
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

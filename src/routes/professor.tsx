import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { AppShell } from "@/components/AppShell";
import { FullPageLoader } from "@/components/States";
import { Confetti } from "@/components/Feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceTab } from "@/components/teacher/AttendanceTab";
import { HistoryTab } from "@/components/teacher/HistoryTab";
import { QuizzesTab } from "@/components/teacher/QuizzesTab";

export const Route = createFileRoute("/professor")({
  head: () => ({
    meta: [
      { title: "Painel do Professor · Classe Viva" },
      {
        name: "description",
        content:
          "Faça a chamada gamificada, lance pontos em um clique, crie quizzes e acompanhe as respostas da turma.",
      },
      { property: "og:title", content: "Painel do Professor · Classe Viva" },
      {
        property: "og:description",
        content: "Chamada, extrato da turma e criação de quizzes em um só lugar.",
      },
    ],
  }),
  component: TeacherPage,
});

function TeacherPage() {
  const { ready } = useRoleGuard("teacher");
  const [fire, setFire] = useState(0);

  if (!ready) return <FullPageLoader />;

  return (
    <AppShell
      title="Painel do Professor"
      subtitle="Lance pontos, acompanhe o extrato e crie perguntas para a turma."
    >
      <Confetti fire={fire} />
      <Tabs defaultValue="chamada">
        <TabsList className="mb-5 grid w-full grid-cols-3">
          <TabsTrigger value="chamada">Chamada</TabsTrigger>
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
        </TabsList>
        <TabsContent value="chamada">
          <AttendanceTab onCelebrate={() => setFire((v) => v + 1)} />
        </TabsContent>
        <TabsContent value="extrato">
          <HistoryTab />
        </TabsContent>
        <TabsContent value="quizzes">
          <QuizzesTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

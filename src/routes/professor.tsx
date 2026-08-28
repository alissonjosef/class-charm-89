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
import { ALL_CLASSES } from "@/components/teacher/ClassBar";

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
  const [classId, setClassId] = useState<string>(() =>
    typeof window === "undefined"
      ? ALL_CLASSES
      : (window.localStorage.getItem("classe-viva:class") ?? ALL_CLASSES),
  );

  function selectClass(value: string) {
    setClassId(value);
    window.localStorage.setItem("classe-viva:class", value);
  }

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
          <AttendanceTab
            classId={classId}
            onClassChange={selectClass}
            onCelebrate={() => setFire((v) => v + 1)}
          />
        </TabsContent>
        <TabsContent value="extrato">
          <HistoryTab classId={classId} onClassChange={selectClass} />
        </TabsContent>
        <TabsContent value="quizzes">
          <QuizzesTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { AppShell } from "@/components/AppShell";
import { FullPageLoader } from "@/components/States";
import { Confetti } from "@/components/Feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceTab } from "@/components/teacher/AttendanceTab";
import { ClassesTab } from "@/components/teacher/ClassesTab";
import { UsersTab } from "@/components/teacher/UsersTab";
import { HistoryTab } from "@/components/teacher/HistoryTab";
import { LessonTab } from "@/components/teacher/LessonTab";
import { QuizzesTab } from "@/components/teacher/QuizzesTab";
import { RulesTab } from "@/components/teacher/RulesTab";
import { ALL_CLASSES } from "@/components/teacher/ClassBar";
import { currentTerm } from "@/lib/terms";

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

  const [term, setTerm] = useState(currentTerm);

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
      <Tabs defaultValue="aula">
        <TabsList className="mb-5 grid h-auto w-full grid-cols-4 sm:grid-cols-7">
          <TabsTrigger value="aula">Aula</TabsTrigger>
          <TabsTrigger value="chamada">Chamada</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="salas">Salas</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="chamada">
          <AttendanceTab
            classId={classId}
            onClassChange={selectClass}
            term={term}
            onTermChange={setTerm}
            onCelebrate={() => setFire((v) => v + 1)}
          />
        </TabsContent>
        <TabsContent value="aula">
          <LessonTab />
        </TabsContent>
        <TabsContent value="extrato">
          <HistoryTab
            classId={classId}
            onClassChange={selectClass}
            term={term}
            onTermChange={setTerm}
          />
        </TabsContent>
        <TabsContent value="quizzes">
          <QuizzesTab
            classId={classId}
            onClassChange={selectClass}
            term={term}
            onTermChange={setTerm}
          />
        </TabsContent>
        <TabsContent value="regras">
          <RulesTab />
        </TabsContent>
        <TabsContent value="salas">
          <ClassesTab
            classId={classId}
            onClassChange={selectClass}
            term={term}
            onTermChange={setTerm}
          />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

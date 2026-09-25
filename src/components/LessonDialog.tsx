import { useEffect, useState } from "react";
import { BookOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { lessonTag, useDeleteLesson, useSaveLesson, type Lesson } from "@/hooks/useLessons";

function lessonDateLabel(lesson: Lesson) {
  return new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

type Props = {
  lesson: Lesson | null;
  onClose: () => void;
  canEdit?: boolean;
};

export function LessonDialog({ lesson, onClose, canEdit = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const saveLesson = useSaveLesson();
  const deleteLesson = useDeleteLesson();

  useEffect(() => {
    setEditing(false);
    setTheme(lesson?.theme ?? "");
    setDescription(lesson?.description ?? "");
  }, [lesson?.id, lesson?.theme, lesson?.description]);

  function save() {
    if (!lesson) return;
    if (!theme.trim()) {
      toast.error("Informe o título da aula");
      return;
    }
    saveLesson.mutate(
      {
        id: lesson.id,
        lessonDate: lesson.lesson_date,
        lessonNumber: lesson.lesson_number,
        theme: theme.trim(),
        description: description.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Aula atualizada");
          setEditing(false);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Erro ao salvar a aula"),
      },
    );
  }

  function remove() {
    if (!lesson) return;
    deleteLesson.mutate(lesson.id, {
      onSuccess: () => {
        toast.success("Aula excluída");
        setConfirmDelete(false);
        onClose();
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Erro ao excluir a aula"),
    });
  }

  return (
    <>
      <Dialog open={Boolean(lesson)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {lesson && (
            <>
              <DialogHeader>
                <DialogDescription className="flex items-center gap-2 capitalize">
                  <BookOpen className="size-3.5" />
                  {lessonDateLabel(lesson)}
                </DialogDescription>
                <p className="text-xs font-semibold text-primary">{lessonTag(lesson)}</p>
                {editing ? (
                  <Input
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    placeholder="Título da aula"
                    className="mt-2"
                  />
                ) : (
                  <DialogTitle className="font-display text-xl">{lesson.theme}</DialogTitle>
                )}
              </DialogHeader>

              {editing ? (
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Conteúdo da aula"
                  rows={10}
                />
              ) : lesson.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{lesson.description}</p>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  Esta aula ainda não tem conteúdo.
                </p>
              )}

              {canEdit && (
                <DialogFooter className="gap-2 sm:justify-between">
                  {editing ? (
                    <>
                      <Button variant="ghost" onClick={() => setEditing(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={save} disabled={saveLesson.isPending}>
                        Salvar alterações
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="softDanger" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="size-4" />
                        Excluir
                      </Button>
                      <Button onClick={() => setEditing(true)}>
                        <Pencil className="size-4" />
                        Editar
                      </Button>
                    </>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a aula “{lesson?.theme}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O título e o conteúdo somem para os alunos. Os pontos já lançados nesta aula continuam
              no extrato, apenas deixam de ficar agrupados por aula.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={deleteLesson.isPending}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

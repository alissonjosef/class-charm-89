import { useState } from "react";
import { Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  useClasses,
  useClassMembers,
  useCreateClass,
  useToggleClassMember,
} from "@/hooks/useClasses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudents } from "@/hooks/useStudents";

export const ALL_CLASSES = "all";

export function ClassBar({
  classId,
  onChange,
  manageable = false,
}: {
  classId: string;
  onChange: (value: string) => void;
  manageable?: boolean;
}) {
  const { data: classes, isLoading } = useClasses();
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState("");
  const createClass = useCreateClass();

  async function submitClass() {
    const clean = name.trim();
    if (!clean) {
      toast.error("Dê um nome para a sala");
      return;
    }
    try {
      const created = await createClass.mutateAsync(clean);
      toast.success(`Sala “${created.name}” criada`);
      setName("");
      setCreating(false);
      onChange(created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a sala");
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select value={classId} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Selecione a sala" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CLASSES}>Todas as salas</SelectItem>
          {(classes ?? []).map((room) => (
            <SelectItem key={room.id} value={room.id}>
              {room.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {manageable ? (
        <>
          <Button variant="soft" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nova sala
          </Button>
          <Button
            variant="soft"
            size="sm"
            disabled={classId === ALL_CLASSES}
            onClick={() => setManaging(true)}
          >
            <Users className="size-4" />
            Alunos da sala
          </Button>
        </>
      ) : null}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova sala</DialogTitle>
            <DialogDescription>
              Crie uma sala para separar as turmas na chamada e no extrato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="class-name">Nome da sala</Label>
            <Input
              id="class-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Turma A — manhã"
              maxLength={60}
            />
          </div>
          <DialogFooter>
            <Button variant="ink" onClick={submitClass} disabled={createClass.isPending}>
              {createClass.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Criar sala
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MembersDialog
        classId={classId === ALL_CLASSES ? null : classId}
        open={managing}
        onOpenChange={setManaging}
      />
    </div>
  );
}

function MembersDialog({
  classId,
  open,
  onOpenChange,
}: {
  classId: string | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { data: students } = useStudents();
  const { data: members } = useClassMembers(classId);
  const toggle = useToggleClassMember(classId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alunos da sala</DialogTitle>
          <DialogDescription>
            Marque quem faz parte desta sala. Só os marcados aparecem na chamada e no extrato dela.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {(students ?? []).map((student) => {
            const isMember = (members ?? []).includes(student.id);
            return (
              <label
                key={student.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50"
              >
                <Checkbox
                  checked={isMember}
                  disabled={toggle.isPending}
                  onCheckedChange={() =>
                    toggle.mutate(
                      { studentId: student.id, member: isMember },
                      {
                        onError: (error) =>
                          toast.error(
                            error instanceof Error ? error.message : "Não foi possível atualizar",
                          ),
                      },
                    )
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{student.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {student.email}
                  </span>
                </span>
              </label>
            );
          })}
          {!students?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum aluno cadastrado ainda.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

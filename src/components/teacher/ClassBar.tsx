import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import {
  useAuthorizeTeacher,
  useClassMembers,
  useClassTeachers,
  useClasses,
  useCreateClass,
  useRenameClass,
  useToggleClassMember,
} from "@/hooks/useClasses";
import { useStudents } from "@/hooks/useStudents";
import { currentTerm, recentTerms, termLabel } from "@/lib/terms";
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

export const ALL_CLASSES = "all";

export function ClassBar({
  classId,
  onChange,
  term,
  onTermChange,
  manageable = false,
}: {
  classId: string;
  onChange: (value: string) => void;
  term: string;
  onTermChange: (value: string) => void;
  manageable?: boolean;
}) {
  const { data: classes, isLoading } = useClasses();
  const [dialog, setDialog] = useState<"none" | "create" | "rename" | "members" | "teachers">(
    "none",
  );
  const [name, setName] = useState("");
  const createClass = useCreateClass();
  const renameClass = useRenameClass();
  const selected = (classes ?? []).find((room) => room.id === classId);

  useEffect(() => {
    if (dialog === "rename") setName(selected?.name ?? "");
    if (dialog === "create") setName("");
  }, [dialog, selected?.name]);

  async function submitName() {
    const clean = name.trim();
    if (!clean) {
      toast.error("Dê um nome para a sala");
      return;
    }
    try {
      if (dialog === "rename" && selected) {
        await renameClass.mutateAsync({ id: selected.id, name: clean });
        toast.success("Nome da sala atualizado");
      } else {
        const created = await createClass.mutateAsync(clean);
        toast.success(`Sala “${created.name}” criada`);
        onChange(created.id);
      }
      setDialog("none");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar");
    }
  }

  const single = classId !== ALL_CLASSES;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select value={classId} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger className="w-full sm:w-56">
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

      <Select value={term} onValueChange={onTermChange}>
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {recentTerms().map((value) => (
            <SelectItem key={value} value={value}>
              {termLabel(value)}
              {value === currentTerm() ? " (atual)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {manageable ? (
        <>
          <Button variant="soft" size="sm" onClick={() => setDialog("create")}>
            <Plus className="size-4" />
            Nova sala
          </Button>
          <Button variant="soft" size="sm" disabled={!single} onClick={() => setDialog("rename")}>
            <Pencil className="size-4" />
            Renomear
          </Button>
          <Button variant="soft" size="sm" disabled={!single} onClick={() => setDialog("members")}>
            <Users className="size-4" />
            Alunos
          </Button>
          <Button variant="soft" size="sm" disabled={!single} onClick={() => setDialog("teachers")}>
            <ShieldCheck className="size-4" />
            Professores
          </Button>
        </>
      ) : null}

      <Dialog
        open={dialog === "create" || dialog === "rename"}
        onOpenChange={(value) => setDialog(value ? dialog : "none")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "rename" ? "Renomear sala" : "Nova sala"}</DialogTitle>
            <DialogDescription>
              O nome da sala aparece na chamada, no extrato e nos quizzes.
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
            <Button
              variant="ink"
              onClick={submitName}
              disabled={createClass.isPending || renameClass.isPending}
            >
              {createClass.isPending || renameClass.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MembersDialog
        classId={single ? classId : null}
        open={dialog === "members"}
        onOpenChange={(value) => setDialog(value ? "members" : "none")}
      />
      <TeachersDialog
        classId={single ? classId : null}
        open={dialog === "teachers"}
        onOpenChange={(value) => setDialog(value ? "teachers" : "none")}
      />
    </div>
  );
}

function PeopleDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function PersonRow({
  name,
  email,
  checked,
  disabled,
  onToggle,
}: {
  name: string;
  email: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={onToggle} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{email}</span>
      </span>
    </label>
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
    <PeopleDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Alunos da sala"
      description="Marque quem faz parte desta sala. Só os marcados aparecem na chamada e no extrato dela."
    >
      {(students ?? []).map((student) => {
        const isMember = (members ?? []).includes(student.id);
        return (
          <PersonRow
            key={student.id}
            name={student.name}
            email={student.email}
            checked={isMember}
            disabled={toggle.isPending}
            onToggle={() =>
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
        );
      })}
      {!students?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum aluno cadastrado ainda.
        </p>
      ) : null}
    </PeopleDialog>
  );
}

function TeachersDialog({
  classId,
  open,
  onOpenChange,
}: {
  classId: string | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { data: students } = useStudents();
  const { data: teachers } = useClassTeachers(classId);
  const authorize = useAuthorizeTeacher(classId);

  return (
    <PeopleDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Professores da sala"
      description="Ao marcar, a pessoa vira professor e passa a gerenciar somente esta sala."
    >
      {(students ?? []).map((person) => {
        const authorized = (teachers ?? []).includes(person.id);
        return (
          <PersonRow
            key={person.id}
            name={person.name}
            email={person.email}
            checked={authorized}
            disabled={authorize.isPending}
            onToggle={() =>
              authorize.mutate(
                { userId: person.id, authorized },
                {
                  onSuccess: () =>
                    toast.success(authorized ? "Autorização removida" : "Professor autorizado"),
                  onError: (error) =>
                    toast.error(
                      error instanceof Error ? error.message : "Não foi possível atualizar",
                    ),
                },
              )
            }
          />
        );
      })}
      {!students?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma pessoa cadastrada ainda.
        </p>
      ) : null}
    </PeopleDialog>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GraduationCap, KeyRound, Loader2, Search, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Person = {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "student";
  isMaster: boolean;
};

function useEveryone() {
  return useQuery({
    queryKey: ["everyone"],
    queryFn: async (): Promise<Person[]> => {
      const [profilesRes, rolesRes, mastersRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email").order("name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("masters").select("user_id"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (mastersRes.error) throw mastersRes.error;
      const teachers = new Set(
        (rolesRes.data ?? []).filter((r) => r.role === "teacher").map((r) => r.user_id),
      );
      const masters = new Set((mastersRes.data ?? []).map((m) => m.user_id));
      return (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        role: teachers.has(p.id) || masters.has(p.id) ? "teacher" : "student",
        isMaster: masters.has(p.id),
      }));
    },
  });
}

export function UsersTab() {
  const { session, isMaster } = useAuth();
  const { data: people, isLoading } = useEveryone();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<Person | null>(null);

  const filtered = (people ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });
  const teachers = filtered.filter((p) => p.role === "teacher");
  const students = filtered.filter((p) => p.role === "student");

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Redefina a senha de alunos ou de outros professores quando esquecerem. A pessoa entra com a
        nova senha na próxima vez.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="pl-9"
        />
      </div>

      {!filtered.length ? (
        <EmptyState title="Ninguém encontrado" text="Tente outro nome ou e-mail." />
      ) : (
        <>
          <PeopleList
            title="Professores"
            people={teachers}
            currentUserId={session?.user.id ?? null}
            callerIsMaster={isMaster}
            onReset={setTarget}
          />
          <PeopleList
            title="Alunos"
            people={students}
            currentUserId={session?.user.id ?? null}
            callerIsMaster={isMaster}
            onReset={setTarget}
          />
        </>
      )}

      <ResetPasswordDialog person={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function PeopleList({
  title,
  people,
  currentUserId,
  callerIsMaster,
  onReset,
}: {
  title: string;
  people: Person[];
  currentUserId: string | null;
  callerIsMaster: boolean;
  onReset: (person: Person) => void;
}) {
  if (!people.length) return null;
  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title} · {people.length}
      </p>
      <ul className="surface divide-y divide-border overflow-hidden">
        {people.map((person) => {
          const locked = person.isMaster && !callerIsMaster;
          return (
            <li
              key={person.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                  person.isMaster
                    ? "bg-gold text-gold-foreground"
                    : person.role === "teacher"
                      ? "bg-ink text-ink-foreground"
                      : "bg-secondary text-secondary-foreground"
                }`}
              >
                {person.isMaster ? (
                  <ShieldCheck className="size-4" />
                ) : person.role === "teacher" ? (
                  <GraduationCap className="size-4" />
                ) : (
                  <UserRound className="size-4" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {person.name}
                  {person.isMaster ? (
                    <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-gold-foreground">
                      master
                    </span>
                  ) : null}
                  {person.id === currentUserId ? (
                    <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={locked}
                title={locked ? "Só o master pode trocar a própria senha" : undefined}
                onClick={() => onReset(person)}
              >
                <KeyRound className="size-3.5" /> Redefinir senha
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ResetPasswordDialog({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const reset = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { error } = await supabase.rpc("reset_user_password", {
        _user_id: userId,
        _new_password: newPassword,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Senha de ${person?.name} redefinida`);
      close();
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível redefinir"),
  });

  function close() {
    setPassword("");
    setConfirm("");
    onClose();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    if (password.length < 6) {
      toast.error("A senha precisa de pelo menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    reset.mutate({ userId: person.id, newPassword: password });
  }

  return (
    <Dialog open={Boolean(person)} onOpenChange={(open) => (!open ? close() : null)}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Nova senha para <strong>{person?.name}</strong> ({person?.email}). As sessões abertas
              dessa pessoa serão encerradas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              maxLength={72}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              maxLength={72}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" variant="ink" disabled={reset.isPending}>
              {reset.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Salvar nova senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

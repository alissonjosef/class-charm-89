import { useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRuleMutations, useRules } from "@/hooks/useRules";
import type { Rule, RuleGroup } from "@/lib/points";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/States";
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível salvar";
}

export function RulesTab() {
  const { data, isLoading } = useRules();
  const { createGroup } = useRuleMutations();
  const [newGroup, setNewGroup] = useState("");

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const groups = data?.groups ?? [];
  const rules = data?.rules ?? [];

  async function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    try {
      await createGroup.mutateAsync({
        name,
        sortOrder: Math.max(-1, ...groups.map((g) => g.sort_order)) + 1,
      });
      setNewGroup("");
      toast.success(`Categoria “${name}” criada`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Estas categorias e regras aparecem na chamada (para lançar pontos) e na aba “Regras” do
        aluno. Alterar os pontos vale só para os próximos lançamentos.
      </p>

      {groups.length ? (
        groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            rules={rules.filter((rule) => rule.group_id === group.id)}
          />
        ))
      ) : (
        <EmptyState
          title="Nenhuma categoria"
          text="Crie uma categoria (ex.: Chamada) e adicione as regras de pontos dentro dela."
        />
      )}

      <form
        className="surface flex flex-wrap items-center gap-2 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          addGroup();
        }}
      >
        <Input
          value={newGroup}
          onChange={(event) => setNewGroup(event.target.value)}
          placeholder="Nova categoria (ex.: Participação)"
          maxLength={40}
          className="flex-1 min-w-48"
        />
        <Button type="submit" variant="ink" size="sm" disabled={createGroup.isPending}>
          {createGroup.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Nova categoria
        </Button>
      </form>
    </div>
  );
}

function GroupCard({ group, rules }: { group: RuleGroup; rules: Rule[] }) {
  const { renameGroup, deleteGroup, createRule } = useRuleMutations();
  const [name, setName] = useState(group.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPoints, setNewPoints] = useState("10");

  async function saveName() {
    const clean = name.trim();
    if (!clean || clean === group.name) {
      setName(group.name);
      return;
    }
    try {
      await renameGroup.mutateAsync({ id: group.id, name: clean });
    } catch (error) {
      toast.error(errorMessage(error));
      setName(group.name);
    }
  }

  async function addRule() {
    const label = newLabel.trim();
    const points = Number(newPoints);
    if (!label) {
      toast.error("Dê um nome para a regra");
      return;
    }
    if (!Number.isInteger(points)) {
      toast.error("Pontos precisa ser um número inteiro");
      return;
    }
    try {
      await createRule.mutateAsync({
        groupId: group.id,
        label,
        points,
        sortOrder: Math.max(-1, ...rules.map((r) => r.sort_order)) + 1,
      });
      setNewLabel("");
      setNewPoints("10");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
          maxLength={40}
          aria-label="Nome da categoria"
          className="h-9 border-transparent bg-transparent font-display text-sm font-semibold shadow-none focus-visible:border-input"
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Excluir categoria"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} />
        ))}
        {!rules.length ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            Nenhuma regra nesta categoria.
          </li>
        ) : null}
      </ul>

      <form
        className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 border-t border-border bg-secondary/30 px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          addRule();
        }}
      >
        <Input
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder="Nova regra (ex.: Trouxe caderno)"
          maxLength={60}
          className="h-9"
        />
        <Input
          type="number"
          step={1}
          value={newPoints}
          onChange={(event) => setNewPoints(event.target.value)}
          aria-label="Pontos"
          className="h-9 text-right"
        />
        <Button type="submit" variant="soft" size="sm" disabled={createRule.isPending}>
          {createRule.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Adicionar
        </Button>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria “{group.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              As {rules.length} regra(s) dela deixam de aparecer na chamada. O extrato já lançado
              não muda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteGroup.mutate(group.id, {
                  onSuccess: () => toast.success("Categoria excluída"),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const { updateRule, deleteRule } = useRuleMutations();
  const [label, setLabel] = useState(rule.label);
  const [points, setPoints] = useState(String(rule.points));
  const dirty = label.trim() !== rule.label || Number(points) !== rule.points;

  async function save() {
    const clean = label.trim();
    const value = Number(points);
    if (!clean) {
      toast.error("Dê um nome para a regra");
      return;
    }
    if (!Number.isInteger(value)) {
      toast.error("Pontos precisa ser um número inteiro");
      return;
    }
    try {
      await updateRule.mutateAsync({ id: rule.id, label: clean, points: value });
      toast.success("Regra atualizada");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_5rem_auto_auto] items-center gap-2 px-3 py-2">
      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        maxLength={60}
        aria-label="Nome da regra"
        className="h-9"
      />
      <Input
        type="number"
        step={1}
        value={points}
        onChange={(event) => setPoints(event.target.value)}
        aria-label="Pontos"
        className={`h-9 text-right font-display font-bold ${
          Number(points) >= 0 ? "text-success" : "text-destructive"
        }`}
      />
      <Button
        variant={dirty ? "softSuccess" : "ghost"}
        size="icon"
        aria-label="Salvar regra"
        disabled={!dirty || updateRule.isPending}
        onClick={save}
      >
        {updateRule.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Excluir regra"
        disabled={deleteRule.isPending}
        onClick={() =>
          deleteRule.mutate(rule.id, {
            onSuccess: () => toast.success(`Regra “${rule.label}” excluída`),
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </li>
  );
}

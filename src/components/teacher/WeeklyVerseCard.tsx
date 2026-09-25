import { useState } from "react";
import { CalendarClock, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VerseDialog } from "@/components/VerseDialog";
import {
  currentVerse,
  useDeleteWeeklyVerse,
  useSaveWeeklyVerse,
  useWeeklyVerses,
  type WeeklyVerse,
} from "@/hooks/useWeeklyVerses";
import { todayInSaoPaulo } from "@/lib/terms";

const EMPTY = { releaseDate: "", reference: "", verseText: "", theme: "" };

export function WeeklyVerseCard() {
  const today = todayInSaoPaulo();
  const { data: verses } = useWeeklyVerses();
  const save = useSaveWeeklyVerse();
  const remove = useDeleteWeeklyVerse();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY, releaseDate: today });
  const [openId, setOpenId] = useState<string | null>(null);

  const active = currentVerse(verses);
  const openVerse = verses?.find((v) => v.id === openId) ?? null;

  function startEdit(verse: WeeklyVerse) {
    setEditingId(verse.id);
    setForm({
      releaseDate: verse.release_date,
      reference: verse.reference,
      verseText: verse.verse_text,
      theme: verse.theme ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY, releaseDate: today });
  }

  function submit() {
    const missing = !form.releaseDate
      ? "Escolha a data em que o versículo será liberado"
      : !form.reference.trim()
        ? "Informe a referência (ex.: João 3:16)"
        : !form.verseText.trim()
          ? "Informe o texto do versículo"
          : null;
    if (missing) {
      toast.error(missing);
      return;
    }
    save.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        releaseDate: form.releaseDate,
        reference: form.reference.trim(),
        verseText: form.verseText.trim(),
        theme: form.theme.trim(),
      },
      {
        onSuccess: () => {
          toast.success(editingId ? "Versículo atualizado" : "Versículo da semana salvo");
          cancelEdit();
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Erro ao salvar o versículo"),
      },
    );
  }

  function del(verse: WeeklyVerse) {
    remove.mutate(verse.id, {
      onSuccess: () => {
        toast.success("Versículo excluído");
        if (editingId === verse.id) cancelEdit();
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Erro ao excluir o versículo"),
    });
  }

  return (
    <section className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5 text-gold" /> Versículo da semana
        </p>
        {active && (
          <button
            type="button"
            onClick={() => setOpenId(active.id)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Em destaque agora: {active.reference}
          </button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Liberar em</span>
          <Input
            type="date"
            value={form.releaseDate}
            onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Referência</span>
          <Input
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="Ex.: João 3:16"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Tema</span>
        <Input
          value={form.theme}
          onChange={(e) => setForm({ ...form, theme: e.target.value })}
          placeholder="Ex.: O amor de Deus"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Texto do versículo</span>
        <Textarea
          value={form.verseText}
          onChange={(e) => setForm({ ...form, verseText: e.target.value })}
          placeholder="Porque Deus amou o mundo de tal maneira..."
          rows={3}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} disabled={save.isPending}>
          {editingId ? "Salvar alterações" : "Salvar versículo"}
        </Button>
        {editingId && (
          <Button variant="ghost" onClick={cancelEdit}>
            <X className="size-4" /> Cancelar edição
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Na data escolhida o versículo abre automaticamente para o aluno ao entrar e fica no
        histórico da aba Aulas dele.
      </p>

      {Boolean(verses?.length) && (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {verses!.map((verse) => {
            const released = verse.release_date <= today;
            return (
              <li key={verse.id} className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setOpenId(verse.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">{verse.reference}</span>
                    {verse.theme && (
                      <span className="truncate text-xs text-muted-foreground">
                        · {verse.theme}
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" />
                    {new Date(`${verse.release_date}T00:00:00`).toLocaleDateString("pt-BR")}
                    {released ? " · liberado" : " · agendado"}
                    {active?.id === verse.id ? " · em destaque" : ""}
                  </p>
                </button>
                <Button variant="ghost" size="icon" onClick={() => startEdit(verse)} title="Editar">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => del(verse)}
                  disabled={remove.isPending}
                  title="Excluir"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <VerseDialog verse={openVerse} onClose={() => setOpenId(null)} />
    </section>
  );
}

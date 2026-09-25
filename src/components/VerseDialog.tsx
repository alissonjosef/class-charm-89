import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { verseDateLabel, type WeeklyVerse } from "@/hooks/useWeeklyVerses";

type Props = {
  verse: WeeklyVerse | null;
  onClose: () => void;
  /** Destaque "Versículo da semana" (abertura automática ao entrar). */
  highlight?: boolean;
};

export function VerseDialog({ verse, onClose, highlight = false }: Props) {
  return (
    <Dialog open={Boolean(verse)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        {verse && (
          <>
            <DialogHeader>
              <DialogDescription className="flex items-center gap-2 capitalize">
                <Sparkles className="size-3.5 text-gold" />
                {highlight ? "Versículo da semana · " : ""}
                {verseDateLabel(verse.release_date)}
              </DialogDescription>
              {verse.theme && (
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {verse.theme}
                </p>
              )}
              <DialogTitle className="font-display text-xl">{verse.reference}</DialogTitle>
            </DialogHeader>
            <blockquote className="rounded-2xl bg-ink p-5 font-display text-lg leading-relaxed text-ink-foreground shadow-soft">
              “{verse.verse_text}”
            </blockquote>
            {highlight && (
              <Button className="w-full" onClick={onClose}>
                Amém, vamos estudar!
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

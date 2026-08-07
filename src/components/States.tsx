import { Loader2 } from "lucide-react";

export function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="surface animate-pop-in p-8 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

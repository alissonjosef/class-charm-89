import { useEffect, useState } from "react";

type Piece = { id: number; left: number; delay: number; dx: number; dr: number; color: string; size: number };

const COLORS = ["bg-gold", "bg-primary", "bg-success", "bg-destructive"];

/** Confete leve, sem dependências: dispara quando `fire` muda. */
export function Confetti({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!fire) return;
    const next: Piece[] = Array.from({ length: 40 }, (_, i) => ({
      id: fire * 1000 + i,
      left: Math.random() * 100,
      delay: Math.random() * 0.35,
      dx: (Math.random() - 0.5) * 260,
      dr: 360 + Math.random() * 720,
      color: COLORS[i % COLORS.length]!,
      size: 6 + Math.round(Math.random() * 6),
    }));
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 2200);
    return () => clearTimeout(t);
  }, [fire]);

  if (!pieces.length) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-100 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`absolute top-0 animate-confetti rounded-[2px] ${p.color}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            animationDelay: `${p.delay}s`,
            ["--dx" as string]: `${p.dx}px`,
            ["--dr" as string]: `${p.dr}deg`,
          }}
        />
      ))}
    </div>
  );
}

/** Balão "+10" que sobe e desaparece. */
export function PointsBurst({ value, id }: { value: number; id: number }) {
  const positive = value >= 0;
  return (
    <span
      key={id}
      className={`pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 animate-float-up text-sm font-bold ${
        positive ? "text-success" : "text-destructive"
      }`}
    >
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

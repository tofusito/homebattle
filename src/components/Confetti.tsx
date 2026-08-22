import { useEffect, useState } from "react";

const COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--soon)",
  "var(--lucy)",
  "var(--manu)",
  "var(--fresh)",
];

interface Piece {
  id: number;
  left: number;
  dx: number;
  dy: number;
  dr: number;
  delay: number;
  size: number;
  color: string;
  round: boolean;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 8 + Math.random() * 84,
    dx: (Math.random() - 0.5) * 220,
    dy: 240 + Math.random() * 320,
    dr: Math.random() * 900 - 450,
    delay: Math.random() * 160,
    size: 6 + Math.random() * 8,
    color: COLORS[i % COLORS.length]!,
    round: Math.random() > 0.55,
  }));
}

/** Confetti tonto y alegre, sin dependencias. */
export function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    setPieces(makePieces(34));
    const timeout = setTimeout(() => setPieces([]), 1600);
    return () => clearTimeout(timeout);
  }, [trigger]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-[22%]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 1.8),
            background: p.color,
            borderRadius: p.round ? "999px" : "2px",
            animation: `confetti-fall 1.35s cubic-bezier(0.2, 0.6, 0.35, 1) ${p.delay}ms both`,
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
            ["--dr" as string]: `${p.dr}deg`,
          }}
        />
      ))}
    </div>
  );
}

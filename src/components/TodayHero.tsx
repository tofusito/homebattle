import type { CSSProperties } from "react";

import type { Person } from "@/lib/cleaning";
import { cn } from "@/lib/utils";

export function TodayHero({
  person,
  ownPending,
  partnerPending,
  done,
  late,
}: {
  person: Person;
  ownPending: number;
  partnerPending: number;
  done: number;
  late: number;
}) {
  const headline =
    ownPending === 0
      ? "Todo tuyo, resuelto"
      : ownPending === 1
        ? "cosa tuya hoy"
        : "cosas tuyas hoy";
  const detail =
    late > 0
      ? `${late === 1 ? "Una lleva esperando" : `${late} llevan esperando`}, pero se arregla en un toque.`
      : ownPending === 0 && partnerPending === 0
        ? "La casa va ligera. Momento sofá merecido."
        : done > 0
          ? `${done} ${done === 1 ? "turno resuelto" : "turnos resueltos"}. Buen ritmo.`
          : "Sin prisas raras: primero lo que te toca a ti.";

  return (
    <section
      style={
        {
          "--hero-tint": person.id === "lucy" ? "var(--lucy-soft)" : "var(--manu-soft)",
        } as CSSProperties
      }
      className="hero-wash animate-rise-in relative overflow-hidden rounded-3xl border border-border/60 p-6"
    >
      <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        Hoy para {person.label}
      </p>

      {ownPending === 0 ? (
        <h2 className="mt-3 text-3xl leading-[1.05] font-semibold text-balance-tight">
          {headline}
        </h2>
      ) : (
        <p className="mt-2 flex items-baseline gap-2.5">
          <span className="font-display text-6xl leading-none font-semibold tracking-tight text-primary tabular-nums">
            {ownPending}
          </span>
          <span className="text-xl leading-tight font-semibold">{headline}</span>
        </p>
      )}

      <p className="mt-3 max-w-[80%] text-sm leading-relaxed text-muted-foreground">{detail}</p>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <Stat value={done} label={done === 1 ? "resuelto" : "resueltos"} />
        {partnerPending > 0 ? <Stat value={partnerPending} label="de la otra mitad" /> : null}
        {late > 0 ? <Stat value={late} label="esperando" tone="late" /> : null}
      </div>

      <span
        className="pointer-events-none absolute -right-3 -bottom-4 text-7xl opacity-25 select-none"
        aria-hidden="true"
      >
        {person.emoji}
      </span>
    </section>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "late" }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={cn("text-sm font-bold tabular-nums", tone === "late" && "text-late")}>
        {value}
      </span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

import { Sparkles } from "lucide-react";

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
      ? "Tu parte está tranquila"
      : ownPending === 1
        ? "Solo tienes una cosa"
        : `Tienes ${ownPending} cosas hoy`;
  const detail =
    late > 0
      ? `${late === 1 ? "Hay una tarea pendiente" : `Hay ${late} tareas pendientes`}, pero se arregla en un toque.`
      : ownPending === 0 && partnerPending === 0
        ? "La casa va ligera. Momento sofá merecido."
        : done > 0
          ? `${done} ${done === 1 ? "turno resuelto" : "turnos resueltos"}. Buen ritmo.`
          : "Sin prisas raras: primero lo que te toca a ti.";
  const mood =
    late > 0
      ? { house: "🏠", face: "👀", label: "La casa pide un pequeño rescate" }
      : ownPending === 0
        ? { house: "🏡", face: "✨", label: "La casa está de buen humor" }
        : done > 0
          ? { house: "🏠", face: "🙌", label: "La casa nota el progreso" }
          : { house: "🏠", face: "🌤️", label: "Todo bajo control" };

  return (
    <section
      className={cn(
        "hero-wash animate-rise-in relative overflow-hidden rounded-[2rem] border p-5 shadow-sm sm:p-6",
        person.id === "lucy" ? "border-lucy/20" : "border-manu/20",
      )}
    >
      <div className="relative z-10 max-w-[75%]">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.12em] uppercase",
            person.id === "lucy" ? "bg-lucy-soft text-lucy" : "bg-manu-soft text-manu",
          )}
        >
          <Sparkles className="size-3" /> Hoy para {person.label}
        </span>
        <h2 className="mt-3 text-3xl leading-[1.05] font-semibold text-balance-tight">
          {headline}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-card/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <span>{mood.house}</span> {mood.label} {mood.face}
        </p>
      </div>
      <div className="absolute -right-2 bottom-0 select-none" aria-hidden="true">
        <span className="mascot-float relative z-10 block text-7xl drop-shadow-sm">
          {person.emoji}
        </span>
        <span className="mascot-peek absolute -top-3 -left-10 block text-4xl opacity-90">
          {person.id === "lucy" ? "🐱" : "🦄"}
        </span>
      </div>
    </section>
  );
}

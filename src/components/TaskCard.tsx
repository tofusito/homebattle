import { Check, ChevronsRight, Sparkles } from "lucide-react";
import { useState } from "react";

import {
  formatWhen,
  isRescueState,
  isTaskStateSatisfied,
  personById,
  type Person,
  type PersonId,
  type TaskState,
} from "@/lib/cleaning";
import { STATUS_COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";

const RING = {
  // El estado se lee en el punto de color y el texto; la tarjeta se mantiene
  // limpia y el color queda como acento en el borde.
  fresh: "border-fresh/25 bg-card",
  later: "border-later/25 bg-card",
  soon: "border-soon/30 bg-card",
  late: "border-late/35 bg-card",
  on_demand: "border-border bg-card",
};
const DOT = {
  fresh: "bg-fresh",
  later: "bg-later",
  soon: "bg-soon",
  late: "bg-late",
  on_demand: "bg-muted-foreground",
};
interface Props {
  state: TaskState;
  zoneLabel: string;
  people: Person[];
  person: PersonId;
  index: number;
  onDone: (taskId: string, occurrenceDate?: string) => void;
  onSkip?: (taskId: string, occurrenceDate?: string) => void;
  pending?: boolean;
}

export function TaskCard({
  state,
  zoneLabel,
  people,
  person,
  index,
  onDone,
  onSkip,
  pending,
}: Props) {
  const [justDone, setJustDone] = useState(false);
  const { task, status, last, assignedTo } = state;
  const assigned = assignedTo ? personById(people, assignedTo) : null;
  const triggeredBy = state.triggeredBy ? personById(people, state.triggeredBy) : null;
  const lastPerson = last ? personById(people, last.personId) : null;
  const rescued = isRescueState(state);
  const waivedOwner = last?.waivedOwnerId ? personById(people, last.waivedOwnerId) : null;
  const rescuedOwner =
    rescued && last?.assignedPersonId ? personById(people, last.assignedPersonId) : null;
  const completed = state.task.schedule.type !== "on_demand" && isTaskStateSatisfied(state);
  const waitingForSource = state.task.schedule.type === "linked" && !state.assignedTo;
  const canSkipMeal =
    (task.id === "cocina_comida" || task.id === "cocina_cena") &&
    assignedTo === person &&
    !completed;

  const handle = () => {
    if (pending || completed || waitingForSource) return;
    setJustDone(true);
    window.setTimeout(() => setJustDone(false), 900);
    onDone(task.id, state.occurrenceDate);
  };

  return (
    <article
      className={cn(
        "animate-rise-in card-soft tap-shrink relative overflow-hidden rounded-2xl p-4",
        rescued ? "border-rescue/35 bg-rescue-soft/25" : RING[status],
      )}
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", DOT[status])} />
            <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {zoneLabel} · {STATUS_COPY[status]}
            </span>
          </div>
          <h3 className="mt-1.5 text-lg leading-tight font-semibold">{task.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{task.detail}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{state.dueLabel}</span>
            <span className="rounded-full bg-secondary px-2 py-1 font-semibold">
              {task.points > 0 ? "🏆 Suma 1 punto" : "✓ No suma puntos"}
            </span>
            {assigned ? (
              <span
                className={cn(
                  "rounded-full px-2 py-1 font-semibold",
                  assigned.id === "lucy" ? "bg-lucy-soft text-lucy" : "bg-manu-soft text-manu",
                )}
              >
                {assigned.emoji} Turno de {assigned.label}
              </span>
            ) : null}
          </div>
          {state.rotationLabel ? (
            <p className="mt-1.5 text-xs font-medium text-muted-foreground/80">
              {state.rotationLabel}
            </p>
          ) : null}
          {task.schedule.type === "linked" && triggeredBy && assigned ? (
            <p className="mt-2 rounded-xl bg-secondary/70 px-2.5 py-2 text-xs font-medium text-muted-foreground">
              {task.zoneId === "cocina" ? "🍽️" : "🧺"} {triggeredBy.label}{" "}
              {task.zoneId === "cocina" ? "cocinó" : "lavó y tendió"} ·{" "}
              {completed && lastPerson ? (
                <>
                  {lastPerson.label}{" "}
                  {task.zoneId === "cocina"
                    ? "recogió y limpió"
                    : task.id === "ropa_recoger_trapos"
                      ? "recogió y guardó"
                      : "recogió y dobló"}
                </>
              ) : (
                <>ahora le toca a {assigned.label}</>
              )}
            </p>
          ) : null}
          {last?.waivedByRewardId && lastPerson && waivedOwner ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-soon-soft/65 px-2.5 py-2 text-xs font-semibold text-soon">
              🛋️ Vale de {waivedOwner.label}: {lastPerson.label} tomó el relevo sin penalización
            </p>
          ) : rescued && lastPerson && rescuedOwner ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-card/65 px-2.5 py-2 text-xs font-semibold text-rescue">
              <Sparkles className="size-3.5 shrink-0" />
              {lastPerson.label} la hizo · era turno de {rescuedOwner.label}
            </p>
          ) : last && lastPerson ? (
            <p className="mt-2 text-xs">
              <span className="opacity-70">Última vez:</span>{" "}
              <span className="font-semibold">
                {lastPerson.emoji} {lastPerson.label}
              </span>{" "}
              <span className="opacity-70">
                {formatWhen(last.completedAt, last.reportedPeriod)}
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={handle}
            disabled={pending || completed || waitingForSource}
            aria-label={`Marcar ${task.name} como hecha`}
            className={cn(
              "grid size-12 place-items-center rounded-full border-2 transition-all duration-200",
              "border-foreground/15 bg-card hover:border-accent hover:bg-accent/10 active:scale-90",
              justDone && "border-accent bg-accent text-accent-foreground",
              (pending || completed || waitingForSource) && "opacity-50",
            )}
          >
            <Check
              className={cn("size-6", justDone ? "animate-pop-check" : "opacity-45")}
              strokeWidth={justDone ? 3 : 2.4}
            />
          </button>
          {canSkipMeal && onSkip ? (
            <button
              type="button"
              onClick={() => onSkip(task.id, state.occurrenceDate)}
              disabled={pending}
              aria-label={`Saltar ${task.name}`}
              title="Saltar este turno"
              className="grid size-9 place-items-center rounded-full border border-foreground/10 bg-secondary/75 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary active:scale-90"
            >
              <ChevronsRight className="size-4.5" strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      </div>
      <span className="sr-only">Marcarás la tarea como {personById(people, person).label}</span>
    </article>
  );
}

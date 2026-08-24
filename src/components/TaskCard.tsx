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

  // Una sola línea de contexto: el plazo y, si lo hay, de quién es el turno.
  // Todo lo demás (detalle, rotación, historias de relevo) es secundario y
  // solo aparece cuando dice algo que no se deduce del propio título.
  const note = state.rotationLabel && !completed ? state.rotationLabel : null;

  return (
    <article
      className={cn(
        "animate-rise-in tap-shrink group relative rounded-2xl border p-4 transition-shadow",
        "hover:shadow-[var(--shadow-soft)]",
        rescued ? "border-rescue/30 bg-rescue-soft/20" : RING[status],
      )}
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("size-1.5 shrink-0 rounded-full", DOT[status])} />
            <span className="truncate text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {zoneLabel}
            </span>
          </div>

          <h3 className="mt-1.5 text-[1.05rem] leading-snug font-semibold">{task.name}</h3>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className={cn("font-medium", status === "late" && "text-late")}>
              {state.dueLabel}
            </span>
            {assigned ? (
              <>
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    assigned.id === "lucy" ? "text-lucy" : "text-manu",
                  )}
                >
                  {assigned.emoji} {assigned.label}
                </span>
              </>
            ) : null}
          </p>

          {note ? <p className="mt-1 text-xs text-muted-foreground/70">{note}</p> : null}

          {task.schedule.type === "linked" && triggeredBy && assigned && !completed ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {task.zoneId === "cocina" ? "🍽️" : "🧺"} {triggeredBy.label}{" "}
              {task.zoneId === "cocina" ? "cocinó" : "lavó y tendió"} · ahora le toca a{" "}
              {assigned.label}
            </p>
          ) : null}

          {last?.waivedByRewardId && lastPerson && waivedOwner ? (
            <p className="mt-2 text-xs font-semibold text-soon">
              🛋️ Vale de {waivedOwner.label}: {lastPerson.label} tomó el relevo
            </p>
          ) : rescued && lastPerson && rescuedOwner ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rescue">
              <Sparkles className="size-3.5 shrink-0" />
              {lastPerson.label} la hizo · era de {rescuedOwner.label}
            </p>
          ) : completed && last && lastPerson ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {lastPerson.emoji} {lastPerson.label} ·{" "}
              {formatWhen(last.completedAt, last.reportedPeriod)}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canSkipMeal && onSkip ? (
            <button
              type="button"
              onClick={() => onSkip(task.id, state.occurrenceDate)}
              disabled={pending}
              aria-label={`Saltar ${task.name}`}
              title="Saltar este turno"
              className="grid size-9 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-primary active:scale-90"
            >
              <ChevronsRight className="size-5" strokeWidth={2.4} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handle}
            disabled={pending || completed || waitingForSource}
            aria-label={`Marcar ${task.name} como hecha`}
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full border transition-all duration-200",
              completed
                ? "border-transparent bg-accent/15 text-accent"
                : "border-border text-muted-foreground/60 hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-90",
              justDone && "border-transparent bg-accent text-accent-foreground",
              (pending || waitingForSource) && "opacity-50",
            )}
          >
            <Check
              className={cn("size-5", justDone && "animate-pop-check")}
              strokeWidth={completed || justDone ? 3 : 2.4}
            />
          </button>
        </div>
      </div>
      <span className="sr-only">Marcarás la tarea como {personById(people, person).label}</span>
    </article>
  );
}

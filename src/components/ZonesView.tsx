import { Check, ChevronDown, ChevronsRight, Clock3, Sparkles } from "lucide-react";

import { ZoneIcon } from "@/components/ZoneIcon";
import {
  isOnDemandTask,
  isRescueState,
  isTaskStateSatisfied,
  personById,
  type Person,
  type PersonId,
  type TaskState,
  type Zone,
} from "@/lib/cleaning";
import { STATUS_COPY } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useOpenSections } from "@/hooks/use-open-sections";

const DOT = {
  fresh: "bg-fresh",
  later: "bg-later",
  soon: "bg-soon",
  late: "bg-late",
  on_demand: "bg-muted-foreground",
};

export function ZonesView({
  states,
  zones,
  people,
  currentPerson,
  onDone,
  onSkip,
}: {
  states: TaskState[];
  zones: Zone[];
  people: Person[];
  currentPerson: PersonId;
  onDone: (taskId: string) => void;
  onSkip: (taskId: string) => void;
}) {
  const { isSectionOpen, setSectionOpen } = useOpenSections("happy-home:open-zones");
  const weeklyStates = states.filter(
    (state) =>
      (state.task.schedule.type === "weekly" ||
        state.task.schedule.type === "on_demand_weekly" ||
        state.task.schedule.type === "monthly_first_sunday") &&
      !state.dueLabel.startsWith("Empieza"),
  );

  return (
    <section className="space-y-7">
      <div className="animate-rise-in">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Vista general
        </p>
        <h2 className="mt-1 text-3xl font-semibold">La casa, bien ordenada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Primero los turnos de la semana; después, cada zona con su propio cajón.
        </p>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Clock3 className="size-4 text-primary" />
          <h3 className="text-lg font-semibold">Esta semana</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {people.map((person, index) => {
            const tasks = weeklyStates
              .filter((state) => state.assignedTo === person.id)
              .sort((a, b) => a.task.sortOrder - b.task.sortOrder);
            const completed = tasks.filter(isWeeklySatisfied).length;
            return (
              <article
                key={person.id}
                className={cn(
                  "animate-rise-in rounded-3xl border p-4",
                  person.id === "lucy"
                    ? "border-lucy/20 bg-lucy-soft/35"
                    : "border-manu/20 bg-manu-soft/35",
                  person.id === currentPerson && "ring-2 ring-primary/15",
                )}
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">
                    {person.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-xl font-semibold">{person.label}</h4>
                      {person.id === currentPerson ? (
                        <span className="rounded-full bg-card/80 px-2 py-0.5 text-xs font-bold text-primary uppercase">
                          Tú
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tasks.length === 0
                        ? "Sin turnos esta semana"
                        : `${completed}/${tasks.length} resueltas`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {tasks.length === 0 ? (
                    <p className="rounded-2xl bg-card/55 px-3 py-3 text-xs text-muted-foreground">
                      Semana despejada ✨
                    </p>
                  ) : (
                    tasks.map((state) => (
                      <WeeklyTask
                        key={state.task.id}
                        state={state}
                        people={people}
                        onDone={() => onDone(state.task.id)}
                      />
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border/70 pt-6">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Por zonas</h3>
            <p className="text-xs text-muted-foreground">
              Ábrelas solo cuando quieras ver o hacer algo allí.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {zones.map((zone) => {
            const items = states
              .filter((state) => state.task.zoneId === zone.id)
              .sort((a, b) => a.task.sortOrder - b.task.sortOrder);
            const scheduled = items.filter((state) => !isOnDemandTask(state));
            const onDemand = items.filter(isOnDemandTask);
            const attention = items.filter(needsAttention).length;
            return (
              <details
                key={zone.id}
                open={isSectionOpen(zone.id)}
                onToggle={(event) => setSectionOpen(zone.id, event.currentTarget.open)}
                className="zone-drawer group card-soft overflow-hidden rounded-3xl"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5">
                  <span className="bg-secondary text-primary grid size-11 shrink-0 place-items-center rounded-2xl">
                    <ZoneIcon zone={zone.id} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl font-semibold">{zone.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {zone.tagline} · {items.length} {items.length === 1 ? "tarea" : "tareas"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:block",
                      attention ? "bg-soon-soft text-soon" : "bg-fresh-soft text-fresh",
                    )}
                  >
                    {attention ? `${attention} en turno` : "tranquila"}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border/65 bg-paper/45 px-3 pb-4 sm:px-4">
                  {scheduled.length > 0 ? (
                    <TaskGroup
                      title="Programadas"
                      items={scheduled}
                      people={people}
                      currentPerson={currentPerson}
                      onDone={onDone}
                      onSkip={onSkip}
                    />
                  ) : null}
                  {onDemand.length > 0 ? (
                    <TaskGroup
                      title="A demanda"
                      items={onDemand}
                      people={people}
                      currentPerson={currentPerson}
                      onDone={onDone}
                      onSkip={onSkip}
                    />
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TaskGroup({
  title,
  items,
  people,
  currentPerson,
  onDone,
  onSkip,
}: {
  title: string;
  items: TaskState[];
  people: Person[];
  currentPerson: PersonId;
  onDone: (taskId: string) => void;
  onSkip: (taskId: string) => void;
}) {
  return (
    <div className="pt-4">
      <p className="mb-2 px-1 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((state) => (
          <ZoneTask
            key={state.task.id}
            state={state}
            people={people}
            currentPerson={currentPerson}
            onDone={onDone}
            onSkip={onSkip}
          />
        ))}
      </div>
    </div>
  );
}

function WeeklyTask({
  state,
  people,
  onDone,
}: {
  state: TaskState;
  people: Person[];
  onDone: () => void;
}) {
  const satisfied = isWeeklySatisfied(state);
  const rescued = isRescueState(state);
  const actor = state.last ? personById(people, state.last.personId) : null;
  const owner =
    rescued && state.last?.assignedPersonId
      ? personById(people, state.last.assignedPersonId)
      : null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-sm",
        rescued ? "border-rescue/25 bg-rescue-soft/65" : "border-transparent bg-card/75",
      )}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          rescued ? "bg-rescue" : satisfied ? "bg-fresh" : DOT[state.status],
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{state.task.name}</span>
        <span
          className={cn(
            "block truncate text-xs",
            rescued ? "font-semibold text-rescue" : "text-muted-foreground",
          )}
        >
          {rescued && actor && owner
            ? `✨ ${actor.label} la rescató por ${owner.label}`
            : state.dueLabel}
        </span>
      </span>
      <button
        type="button"
        onClick={onDone}
        disabled={satisfied}
        aria-label={`Marcar ${state.task.name} como hecha`}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full border transition-colors",
          rescued
            ? "border-rescue/25 bg-card/70 text-rescue"
            : satisfied
              ? "border-fresh/25 bg-fresh-soft text-fresh"
              : "border-foreground/15 bg-card text-muted-foreground hover:border-accent hover:text-accent",
        )}
      >
        <Check className="size-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}

function ZoneTask({
  state,
  people,
  currentPerson,
  onDone,
  onSkip,
}: {
  state: TaskState;
  people: Person[];
  currentPerson: PersonId;
  onDone: (taskId: string) => void;
  onSkip: (taskId: string) => void;
}) {
  const assigned = state.assignedTo ? personById(people, state.assignedTo) : null;
  const triggeredBy = state.triggeredBy ? personById(people, state.triggeredBy) : null;
  const completed = isTaskStateSatisfied(state);
  const lastActor = state.last ? personById(people, state.last.personId) : null;
  const waitingForSource = state.task.schedule.type === "linked" && !state.assignedTo;
  const canSkipMeal =
    (state.task.id === "cocina_comida" || state.task.id === "cocina_cena") &&
    state.assignedTo === currentPerson &&
    !completed;
  const rescued = isRescueState(state);
  const actor = rescued && state.last ? personById(people, state.last.personId) : null;
  const rescuedOwner =
    rescued && state.last?.assignedPersonId
      ? personById(people, state.last.assignedPersonId)
      : null;
  const waivedOwner = state.last?.waivedOwnerId
    ? personById(people, state.last.waivedOwnerId)
    : null;
  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3 shadow-sm",
        rescued ? "border-rescue/30 bg-rescue-soft/45" : "border-border/75 bg-card/85",
      )}
    >
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          rescued ? "bg-rescue" : DOT[state.status],
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="text-sm font-semibold">{state.task.name}</h4>
          <span className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
            {STATUS_COPY[state.status]}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{state.task.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{state.dueLabel}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold">
            {state.task.points > 0 ? "🏆 Suma 1 punto" : "✓ No suma puntos"}
          </span>
          {assigned ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                assigned.id === "lucy" ? "bg-lucy-soft text-lucy" : "bg-manu-soft text-manu",
              )}
            >
              {assigned.emoji} {assigned.label}
            </span>
          ) : null}
        </div>
        {state.rotationLabel ? (
          <p className="mt-1 text-xs text-muted-foreground/75">{state.rotationLabel}</p>
        ) : null}
        {state.task.schedule.type === "linked" && triggeredBy && assigned ? (
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {state.task.zoneId === "cocina" ? "🍽️" : "🧺"} {triggeredBy.label}{" "}
            {state.task.zoneId === "cocina" ? "cocinó" : "lavó y tendió"} ·{" "}
            {completed && lastActor ? (
              <>
                {lastActor.label}{" "}
                {state.task.zoneId === "cocina"
                  ? "recogió y limpió"
                  : state.task.id === "ropa_recoger_trapos"
                    ? "recogió y guardó"
                    : "recogió y dobló"}
              </>
            ) : (
              <>ahora le toca a {assigned.label}</>
            )}
          </p>
        ) : null}
        {state.last?.waivedByRewardId && actor && waivedOwner ? (
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-soon">
            🛋️ Vale de {waivedOwner.label}: relevo sin penalización
          </p>
        ) : rescued && actor && rescuedOwner ? (
          <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-rescue">
            ✨ {actor.label} la hizo · era turno de {rescuedOwner.label}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDone(state.task.id)}
          disabled={completed || waitingForSource}
          aria-label={`Marcar ${state.task.name} como hecha`}
          className={cn(
            "grid size-11 place-items-center rounded-full border transition-all active:scale-90",
            rescued
              ? "border-rescue/25 bg-card/70 text-rescue"
              : waitingForSource
                ? "border-border bg-muted text-muted-foreground"
                : completed
                  ? "border-fresh/25 bg-fresh-soft text-fresh"
                  : "border-foreground/15 bg-card text-muted-foreground hover:border-accent hover:text-accent",
          )}
        >
          <Check className="size-5" strokeWidth={2.5} />
        </button>
        {canSkipMeal ? (
          <button
            type="button"
            onClick={() => onSkip(state.task.id)}
            aria-label={`Saltar ${state.task.name}`}
            title="Saltar este turno"
            className="grid size-8 place-items-center rounded-full border border-foreground/10 bg-secondary/75 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary active:scale-90"
          >
            <ChevronsRight className="size-4" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function isWeeklySatisfied(state: TaskState): boolean {
  return isTaskStateSatisfied(state);
}

function needsAttention(state: TaskState): boolean {
  if (state.task.schedule.type === "on_demand") return false;
  if (state.task.schedule.type === "on_demand_weekly") return !isWeeklySatisfied(state);
  if (state.task.schedule.type === "linked") {
    return state.assignedTo !== null && !isTaskStateSatisfied(state);
  }
  if (state.dueLabel.startsWith("Empieza")) return false;
  return state.status !== "fresh";
}

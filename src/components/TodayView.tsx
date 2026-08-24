import { ArrowRight, ChevronDown } from "lucide-react";

import { QuickActions } from "@/components/QuickActions";
import { TaskCard } from "@/components/TaskCard";
import { TodayHero } from "@/components/TodayHero";
import { TodayLeagueChip } from "@/components/TodayLeagueChip";
import { ZoneIcon } from "@/components/ZoneIcon";
import { useOpenSections } from "@/hooks/use-open-sections";
import {
  isOnDemandTask,
  isRescueCompletion,
  isTodayTask,
  isWeeklyOverviewTask,
  personById,
  taskStateKey,
  type Completion,
  type Person,
  type PersonId,
  type Task as TaskModel,
  type TaskState,
  type Zone,
} from "@/lib/cleaning";

export function TodayView({
  states,
  graceStates,
  zones,
  people,
  completions,
  tasks,
  person,
  current,
  onDone,
  onSkip,
  onOpenLiga,
  onOpenZonas,
}: {
  states: TaskState[];
  graceStates: TaskState[];
  zones: Zone[];
  people: Person[];
  completions: Completion[];
  tasks: TaskModel[];
  person: PersonId;
  current: Person;
  onDone: (id: string, occurrenceDate?: string) => void;
  onSkip: (id: string, occurrenceDate?: string) => void;
  onOpenLiga: () => void;
  onOpenZonas: () => void;
}) {
  const { isSectionOpen, setSectionOpen } = useOpenSections("happy-home:open-today-zones");
  const zonesById = new Map(zones.map((zone) => [zone.id, zone]));
  const todayTasks = states.filter(isTodayTask);
  const todayPending = todayTasks.filter((state) => state.status !== "fresh");
  const todayDone = todayTasks.filter((state) => state.status === "fresh");
  const orderedGraceStates = [...graceStates].sort(
    (a, b) => Number(b.assignedTo === person) - Number(a.assignedTo === person),
  );
  const ownGrace = graceStates.filter((state) => state.assignedTo === person).length;
  const partnerGrace = graceStates.length - ownGrace;
  const laundryReady = todayPending.filter(
    (state) => state.task.schedule.type === "linked" && state.task.zoneId === "ropa",
  );
  const personalTodayPending = todayPending.filter(
    (state) => !(state.task.schedule.type === "linked" && state.task.zoneId === "ropa"),
  );
  const ownPending = personalTodayPending.filter((state) => state.assignedTo === person);
  const partnerPending = personalTodayPending.filter((state) => state.assignedTo !== person);
  const ownLaundryPending = laundryReady.filter((state) => state.assignedTo === person).length;
  const partnerLaundryPending = laundryReady.length - ownLaundryPending;
  const onDemandTasks = states.filter(isOnDemandTask);
  const quickActions = preferredQuickActions(states);
  const weeklyPending = states.filter(
    (state) =>
      isWeeklyOverviewTask(state) &&
      state.status !== "fresh" &&
      !state.dueLabel.startsWith("Empieza"),
  );

  return (
    <section className="space-y-8">
      <TodayHero
        person={current}
        ownPending={ownPending.length + ownLaundryPending + ownGrace}
        partnerPending={partnerPending.length + partnerLaundryPending + partnerGrace}
        done={todayDone.length}
        late={todayPending.filter((state) => state.status === "late").length}
      />

      <TodayLeagueChip
        completions={completions}
        tasks={tasks}
        person={current}
        onOpen={onOpenLiga}
      />

      {orderedGraceStates.length > 0 ? (
        <div>
          <SectionTitle
            title="Tiempo de descuento"
            subtitle="Podéis cerrarlas durante todo el día de hoy. Se guardan y puntúan con la fecha de ayer."
          />
          <div className="mt-3 space-y-3">
            {orderedGraceStates.map((state, index) => (
              <Task
                key={taskStateKey(state)}
                state={state}
                index={index}
                zone={zonesById.get(state.task.zoneId)}
                people={people}
                person={person}
                onDone={onDone}
                onSkip={onSkip}
              />
            ))}
          </div>
        </div>
      ) : null}

      {laundryReady.length > 0 ? (
        <div>
          <SectionTitle
            title="Ropa lista"
            subtitle="Tiene un turno claro, pero cualquiera puede recogerla y doblarla."
          />
          <div className="mt-3 space-y-3">
            {laundryReady.map((state, index) => (
              <Task
                key={taskStateKey(state)}
                state={state}
                index={index}
                zone={zonesById.get(state.task.zoneId)}
                people={people}
                person={person}
                onDone={onDone}
                onSkip={onSkip}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <SectionTitle
          title="Lo tuyo"
          subtitle={
            ownPending.length === 0
              ? "Tu turno de hoy está en orden."
              : `${ownPending.length} ${ownPending.length === 1 ? "tarea clara" : "tareas claras"}, sin rebuscar.`
          }
        />
        <div className="mt-3 space-y-3">
          {ownPending.length === 0 ? (
            <CompactEmpty emoji={current.emoji} text="Nada más para ti por ahora." />
          ) : (
            ownPending.map((state, index) => (
              <Task
                key={taskStateKey(state)}
                state={state}
                index={index}
                zone={zonesById.get(state.task.zoneId)}
                people={people}
                person={person}
                onDone={onDone}
                onSkip={onSkip}
              />
            ))
          )}
        </div>
      </div>

      {partnerPending.length > 0 ? (
        <details className="group card-soft rounded-3xl px-4 py-3.5">
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <span className="text-2xl">{person === "lucy" ? "🐱" : "🦄"}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Lo de la otra mitad</span>
              <span className="block text-xs text-muted-foreground">
                {partnerPending.length} {partnerPending.length === 1 ? "tarea" : "tareas"} · solo
                por si quieres mirar
              </span>
            </span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-3">
            {partnerPending.map((state, index) => (
              <Task
                key={taskStateKey(state)}
                state={state}
                index={index}
                zone={zonesById.get(state.task.zoneId)}
                people={people}
                person={person}
                onDone={onDone}
                onSkip={onSkip}
              />
            ))}
          </div>
        </details>
      ) : null}

      {todayDone.length > 0 ? (
        <details className="group rounded-3xl border border-fresh/10 bg-fresh-soft/30 px-4 py-3.5">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-semibold text-fresh">
            <span>
              ✓ {todayDone.length}{" "}
              {todayDone.length === 1 ? "turno resuelto hoy" : "turnos resueltos hoy"}
            </span>
            <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {todayDone.map((state) => {
              const rescue = state.last && isRescueCompletion(state.last);
              const actor = rescue ? personById(people, state.last!.personId) : null;
              const owner =
                rescue && state.last!.assignedPersonId
                  ? personById(people, state.last!.assignedPersonId)
                  : null;
              return (
                <span
                  key={taskStateKey(state)}
                  className={
                    rescue
                      ? "rounded-full border border-rescue/25 bg-rescue-soft px-3 py-1.5 text-xs font-semibold text-rescue"
                      : "rounded-full border border-transparent bg-card/80 px-3 py-1.5 text-xs font-semibold"
                  }
                >
                  {state.last?.skipped
                    ? state.dueLabel
                    : rescue && actor && owner
                      ? `✨ ${actor.label} la hizo · era de ${owner.label}`
                      : `${zonesById.get(state.task.zoneId)?.label} · ${state.task.name}`}
                </span>
              );
            })}
          </div>
        </details>
      ) : null}

      {weeklyPending.length > 0 ? (
        <button
          type="button"
          onClick={onOpenZonas}
          className="tap-shrink card-soft flex w-full items-center gap-3 rounded-3xl p-4 text-left"
        >
          <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-lg">
            📅
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">La semana, de un vistazo</span>
            <span className="block text-xs text-muted-foreground">
              {weeklyPending.length}{" "}
              {weeklyPending.length === 1 ? "tarea periódica" : "tareas periódicas"} pendientes en
              Zonas
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </button>
      ) : null}

      <div className="border-t border-border/70 pt-6">
        <QuickActions states={quickActions} person={current} onDone={onDone} />
      </div>

      <div className="border-t border-border/70 pt-6">
        <SectionTitle
          title="A demanda"
          subtitle="Elige una zona y marca solo lo que haya hecho falta."
        />
        <div className="mt-4 space-y-3">
          {zones.map((zone) => {
            const zoneTasks = onDemandTasks.filter((state) => state.task.zoneId === zone.id);
            if (zoneTasks.length === 0) return null;
            return (
              <details
                key={zone.id}
                open={isSectionOpen(zone.id)}
                onToggle={(event) => setSectionOpen(zone.id, event.currentTarget.open)}
                className="group card-soft rounded-3xl px-4 py-3.5"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="bg-secondary text-primary grid size-9 shrink-0 place-items-center rounded-xl">
                    <ZoneIcon zone={zone.id} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold">{zone.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {zoneTasks.length} {zoneTasks.length === 1 ? "opción" : "opciones"} ·{" "}
                      {zone.tagline}
                    </span>
                  </span>
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-3">
                  {zoneTasks.map((state, index) => (
                    <Task
                      key={state.task.id}
                      state={state}
                      index={index}
                      zone={zone}
                      people={people}
                      person={person}
                      onDone={onDone}
                      onSkip={onSkip}
                    />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function preferredQuickActions(states: TaskState[]): TaskState[] {
  const quickActionIds = [
    "cocina_desayuno",
    "cocina_poner_lavavajillas",
    "cocina_lavavajillas",
    "habitacion_hacer_cama",
  ];
  const statesById = new Map(states.map((state) => [state.task.id, state]));
  return quickActionIds
    .map((taskId) => statesById.get(taskId))
    .filter((state): state is TaskState => Boolean(state));
}

function Task({
  state,
  zone,
  ...props
}: {
  state: TaskState;
  zone: Zone | undefined;
  index: number;
  people: Person[];
  person: PersonId;
  onDone: (id: string, occurrenceDate?: string) => void;
  onSkip: (id: string, occurrenceDate?: string) => void;
}) {
  return <TaskCard state={state} zoneLabel={zone?.label ?? state.task.zoneId} {...props} />;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="animate-rise-in">
      <h2 className="text-[0.7rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground/80">{subtitle}</p>
    </div>
  );
}

function CompactEmpty({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-fresh/35 bg-fresh-soft/30 px-4 py-3 text-sm text-muted-foreground">
      <span className="mr-2">{emoji}</span>
      {text}
    </div>
  );
}

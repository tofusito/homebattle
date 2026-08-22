import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Home, ListChecks, Trophy, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Confetti } from "@/components/Confetti";
import { ActivityBell } from "@/components/ActivityBell";
import { PersonPicker } from "@/components/PersonPicker";
import { PreferencesDialog } from "@/components/PreferencesDialog";
import { ProfileView } from "@/components/ProfileView";
import { QuickActions } from "@/components/QuickActions";
import { Scoreboard } from "@/components/Scoreboard";
import { SyncStatus } from "@/components/SyncStatus";
import { TaskCard } from "@/components/TaskCard";
import { TodayHero } from "@/components/TodayHero";
import { TodayLeagueChip } from "@/components/TodayLeagueChip";
import { ZoneIcon } from "@/components/ZoneIcon";
import { ZonesView } from "@/components/ZonesView";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCleaningData, useLiveSync, useMarkDone, useUndo } from "@/hooks/use-cleaning-data";
import { useOpenSections } from "@/hooks/use-open-sections";
import { useGentleReminders } from "@/hooks/use-reminders";
import { usePerson } from "@/hooks/use-person";
import { usePreferences } from "@/hooks/use-preferences";
import { usePushReminders } from "@/hooks/use-push-reminders";
import {
  addDaysKey,
  buildGraceTaskStates,
  buildTaskStates,
  isOnDemandTask,
  isRescueCompletion,
  isTaskStateSatisfied,
  isTodayTask,
  isWeeklyOverviewTask,
  localDateKey,
  personById,
  requiresRescueConfirmation,
  taskStateKey,
  type Completion,
  type PersonId,
  type ScoreReceipt,
  type TaskState,
  type Zone,
} from "@/lib/cleaning";
import { APP_NAME, APP_TAGLINE, CELEBRATIONS, greetingFor } from "@/lib/copy";
import { celebrateInteraction } from "@/lib/delight";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Happy Home · Lucy & Manu" },
      { name: "description", content: "Labores de casa gamificadas para Lucy y Manu." },
      { property: "og:title", content: "Happy Home · Lucy & Manu" },
      { property: "og:description", content: "Una casa, dos personas y turnos sin dramas." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

type Tab = "hoy" | "zonas" | "liga" | "perfil";
const TABS = [
  { id: "hoy" as const, label: "Hoy", icon: Home },
  { id: "zonas" as const, label: "Zonas", icon: ListChecks },
  { id: "liga" as const, label: "Liga", icon: Trophy },
  { id: "perfil" as const, label: "Perfil", icon: UserRound },
];

function Index() {
  const dataQuery = useCleaningData();
  const data = dataQuery.data ?? {
    people: [],
    zones: [],
    tasks: [],
    completions: [],
    settings: {
      weeklyPrize: "Elegir el snack del fin de semana",
      weeklyRewardId: "weekend-snack",
      weeklyRewardWeekKey: "",
    },
    rewards: [],
  };
  const { person, ready, choose, forget } = usePerson(data.people);
  const { preferences, setPreference } = usePreferences();
  const pushReminders = usePushReminders(person);
  const sync = useLiveSync();
  const [tab, setTab] = useState<Tab>("hoy");
  const [profileSection, setProfileSection] = useState<"rewards" | "history">("rewards");
  const [confetti, setConfetti] = useState(0);
  const [pendingRescueStateKey, setPendingRescueStateKey] = useState<string | null>(null);
  const markDone = useMarkDone();
  const undo = useUndo();
  const { isSectionOpen, setSectionOpen } = useOpenSections("happy-home:open-today-zones");
  const states = useMemo(
    () => buildTaskStates(data.tasks, data.completions),
    [data.tasks, data.completions],
  );
  const graceStates = useMemo(
    () => buildGraceTaskStates(data.tasks, data.completions),
    [data.tasks, data.completions],
  );
  const actionableStates = [...graceStates, ...states];
  const zonesById = useMemo(() => new Map(data.zones.map((zone) => [zone.id, zone])), [data.zones]);
  useGentleReminders(states, person, preferences);
  useRescueNotifications(data.completions, data.people, person);

  if (!ready || dataQuery.isLoading) return <Loading />;
  if (dataQuery.isError) return <LoadError onRetry={() => dataQuery.refetch()} />;
  if (!person) return <PersonPicker people={data.people} onChoose={choose} />;

  const current = personById(data.people, person);
  const completeTask = (state: TaskState, rescueConfirmed = false) => {
    if (!rescueConfirmed && requiresRescueConfirmation(state, person, data.rewards)) {
      setPendingRescueStateKey(taskStateKey(state));
      return;
    }
    const completionId = crypto.randomUUID();
    const completedAt = completionTimestampForState(state);
    const rescueOwner =
      state.assignedTo && state.assignedTo !== person
        ? personById(data.people, state.assignedTo)
        : null;
    celebrateInteraction(preferences);
    markDone.mutate(
      {
        id: completionId,
        taskId: state.task.id,
        personId: person,
        ...(state.assignedTo ? { assignedPersonId: state.assignedTo } : {}),
        completedAt,
      },
      {
        onSuccess: ({ queued, receipt, rewardEarned }) => {
          if (receipt?.scored && !preferences.reducedMotion) {
            setConfetti((value) => value + 1);
          }
          const feedback = completionFeedback(
            queued,
            receipt,
            state.task.name,
            current.label,
            rescueOwner?.label,
          );
          toast.success(feedback.title, {
            description: feedback.description,
            action: {
              label: "Deshacer",
              onClick: () => undo.mutate(completionId),
            },
          });
          if (rewardEarned) {
            window.setTimeout(
              () =>
                toast.success(`${rewardEarned.emoji} ¡Vale semanal conseguido!`, {
                  description: `${rewardEarned.title} ya está guardado en tu Perfil.`,
                  action: { label: "Ver", onClick: () => setTab("perfil") },
                }),
              500,
            );
          }
        },
        onError: () =>
          toast.error("No se ha podido guardar", {
            description: "El servidor rechazó el cambio. No se ha añadido a la cola sin conexión.",
          }),
      },
    );
  };
  const handleDone = (taskId: string, occurrenceDate?: string) => {
    const state = actionableStates.find(
      (candidate) => candidate.task.id === taskId && candidate.occurrenceDate === occurrenceDate,
    );
    if (!state) return;
    completeTask(state);
  };
  const handleSkip = (taskId: string, occurrenceDate?: string) => {
    const state = actionableStates.find(
      (candidate) => candidate.task.id === taskId && candidate.occurrenceDate === occurrenceDate,
    );
    if (
      !state ||
      (taskId !== "cocina_comida" && taskId !== "cocina_cena") ||
      state.assignedTo !== person ||
      isTaskStateSatisfied(state)
    ) {
      return;
    }
    const completionId = crypto.randomUUID();
    const completedAt = completionTimestampForState(state);
    markDone.mutate(
      {
        id: completionId,
        taskId,
        personId: person,
        assignedPersonId: person,
        completedAt,
        skipped: true,
      },
      {
        onSuccess: ({ queued }) => {
          const meal = taskId === "cocina_comida" ? "come" : "cena";
          toast.success(`${state.grace ? "Ayer" : "Hoy"} no se ${meal} en casa`, {
            description: queued
              ? "Queda guardado en este móvil y se sincronizará cuando vuelva la conexión."
              : "Turno resuelto sin puntos y sin generar recogida de cocina.",
            action: { label: "Deshacer", onClick: () => undo.mutate(completionId) },
          });
        },
        onError: () =>
          toast.error("No se ha podido saltar el turno", {
            description: "Prueba otra vez cuando el servidor esté disponible.",
          }),
      },
    );
  };
  const pendingRescue =
    actionableStates.find((state) => taskStateKey(state) === pendingRescueStateKey) ?? null;
  const pendingRescueOwner = pendingRescue?.assignedTo
    ? personById(data.people, pendingRescue.assignedTo)
    : null;
  const pendingRescuePoints = pendingRescue?.task.points ?? 0;
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
    <div className={cn("min-h-screen pb-28", preferences.reducedMotion && "reduce-delight")}>
      <Confetti trigger={confetti} />
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 sm:pt-8">
        <header className="animate-rise-in flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-primary uppercase">
              {APP_TAGLINE}
            </p>
            <h1 className="mt-1.5 text-3xl leading-[1.08] font-semibold text-balance-tight sm:text-4xl">
              {APP_NAME}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {greetingFor(person, current.label)} 👋
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "card-soft rounded-full px-3 py-2 text-xs font-semibold",
                person === "lucy" ? "text-lucy" : "text-manu",
              )}
            >
              {current.emoji} {current.label}
            </span>
            <ActivityBell
              completions={data.completions}
              tasks={data.tasks}
              zones={data.zones}
              people={data.people}
              currentPerson={person}
              onViewHistory={() => {
                setProfileSection("history");
                setTab("perfil");
              }}
            />
            <PreferencesDialog
              preferences={preferences}
              setPreference={setPreference}
              onForget={forget}
              onRemindersChange={pushReminders.setEnabled}
              remindersBusy={pushReminders.busy}
            />
          </div>
        </header>

        <main className="mt-6">
          {tab === "hoy" ? (
            <section className="space-y-5">
              <TodayHero
                person={current}
                ownPending={ownPending.length + ownLaundryPending + ownGrace}
                partnerPending={partnerPending.length + partnerLaundryPending + partnerGrace}
                done={todayDone.length}
                late={todayPending.filter((state) => state.status === "late").length}
              />

              <TodayLeagueChip
                completions={data.completions}
                tasks={data.tasks}
                person={current}
                onOpen={() => setTab("liga")}
              />

              {orderedGraceStates.length > 0 ? (
                <div className="rounded-3xl border border-late/20 bg-late-soft/35 p-4">
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
                        people={data.people}
                        person={person}
                        onDone={handleDone}
                        onSkip={handleSkip}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {laundryReady.length > 0 ? (
                <div className="rounded-3xl border border-primary/15 bg-primary/5 p-4">
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
                        people={data.people}
                        person={person}
                        onDone={handleDone}
                        onSkip={handleSkip}
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
                        people={data.people}
                        person={person}
                        onDone={handleDone}
                        onSkip={handleSkip}
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
                        {partnerPending.length} {partnerPending.length === 1 ? "tarea" : "tareas"} ·
                        solo por si quieres mirar
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
                        people={data.people}
                        person={person}
                        onDone={handleDone}
                        onSkip={handleSkip}
                      />
                    ))}
                  </div>
                </details>
              ) : null}

              {todayDone.length > 0 ? (
                <details className="group rounded-3xl border border-fresh/20 bg-fresh-soft/35 px-4 py-3.5">
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
                      const actor = rescue ? personById(data.people, state.last!.personId) : null;
                      const owner =
                        rescue && state.last!.assignedPersonId
                          ? personById(data.people, state.last!.assignedPersonId)
                          : null;
                      return (
                        <span
                          key={taskStateKey(state)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            rescue
                              ? "border-rescue/25 bg-rescue-soft text-rescue"
                              : "border-transparent bg-card/80",
                          )}
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
                  onClick={() => setTab("zonas")}
                  className="tap-shrink card-soft flex w-full items-center gap-3 rounded-3xl p-4 text-left"
                >
                  <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-lg">
                    📅
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">La semana, de un vistazo</span>
                    <span className="block text-xs text-muted-foreground">
                      {weeklyPending.length}{" "}
                      {weeklyPending.length === 1 ? "tarea periódica" : "tareas periódicas"}{" "}
                      pendientes en Zonas
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              ) : null}

              <div className="border-t border-border/70 pt-6">
                <QuickActions states={quickActions} person={current} onDone={handleDone} />
              </div>

              <div className="border-t border-border/70 pt-6">
                <SectionTitle
                  title="A demanda"
                  subtitle="Elige una zona y marca solo lo que haya hecho falta."
                />
                <div className="mt-4 space-y-3">
                  {data.zones.map((zone) => {
                    const zoneTasks = onDemandTasks.filter(
                      (state) => state.task.zoneId === zone.id,
                    );
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
                            <span className="block font-display text-lg font-semibold">
                              {zone.label}
                            </span>
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
                              people={data.people}
                              person={person}
                              onDone={handleDone}
                              onSkip={handleSkip}
                            />
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : tab === "zonas" ? (
            <ZonesView
              states={states}
              zones={data.zones}
              people={data.people}
              currentPerson={person}
              onDone={handleDone}
              onSkip={handleSkip}
            />
          ) : tab === "liga" ? (
            <Scoreboard
              completions={data.completions}
              people={data.people}
              tasks={data.tasks}
              zones={data.zones}
              settings={data.settings}
              rewards={data.rewards}
              currentPerson={person}
            />
          ) : (
            <ProfileView
              currentPerson={person}
              people={data.people}
              rewards={data.rewards}
              completions={data.completions}
              tasks={data.tasks}
              zones={data.zones}
              section={profileSection}
              onSectionChange={setProfileSection}
              onUndo={(id) =>
                undo.mutate(id, { onSuccess: () => toast("Deshecho. Nunca pasó 🤫") })
              }
            />
          )}
          <SyncStatus
            online={sync.online}
            queued={sync.queued}
            live={sync.live}
            fetching={dataQuery.isFetching}
            blocked={sync.blocked}
            onRetry={sync.retry}
            onDiscard={sync.discard}
          />
        </main>
      </div>

      <AlertDialog
        open={Boolean(pendingRescue)}
        onOpenChange={(open) => {
          if (!open) setPendingRescueStateKey(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-[2rem] border-rescue/25 bg-card p-5">
          <AlertDialogHeader className="text-left">
            <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-rescue-soft text-2xl">
              ✨
            </div>
            <AlertDialogTitle className="font-display text-2xl">Confirmar rescate</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              <strong className="text-foreground">{pendingRescue?.task.name}</strong> era turno de{" "}
              {pendingRescueOwner?.label}. Si confirmas, esta acción le restará{" "}
              {pendingRescuePoints} {pendingRescuePoints === 1 ? "punto" : "puntos"}. Si cancelas,
              no se guardará nada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-rescue-soft/65 p-3 text-center text-sm">
            <div>
              <p className="font-bold text-rescue">
                +{pendingRescuePoints} {current.label}
              </p>
              <p className="text-xs text-muted-foreground">por rescatarla</p>
            </div>
            <div>
              <p className="font-bold text-destructive">
                −{pendingRescuePoints} {pendingRescueOwner?.label}
              </p>
              <p className="text-xs text-muted-foreground">punto cedido</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rescue text-white hover:bg-rescue/90"
              onClick={() => {
                if (pendingRescue) completeTask(pendingRescue, true);
                setPendingRescueStateKey(null);
              }}
            >
              Confirmar rescate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <nav className="safe-nav fixed inset-x-0 bottom-0 z-40 px-4 pt-2">
        <div className="card-soft mx-auto flex max-w-md items-center justify-between gap-1 rounded-full p-1.5 backdrop-blur-sm">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-2 text-xs font-semibold transition-all duration-200",
                tab === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icon className="size-4" strokeWidth={2.1} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
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

function completionFeedback(
  queued: boolean,
  receipt: ScoreReceipt | undefined,
  taskName: string,
  actorName: string,
  ownerName?: string,
): { title: string; description: string } {
  if (queued) {
    return {
      title: "Guardado en este móvil",
      description: `${taskName} se sincronizará cuando vuelva la conexión.`,
    };
  }
  if (!receipt || receipt.reason === "non_competitive") {
    return {
      title: "Hecha y registrada ✓",
      description: `${taskName} · queda en el registro, pero no suma puntos.`,
    };
  }
  if (receipt.waived) {
    return {
      title: "🛋️ Vale aplicado: relevo sin penalización",
      description: `${taskName} suma para ${actorName} y no resta ningún punto.`,
    };
  }
  if (receipt.reason === "repeated") {
    return {
      title: "Hecha y registrada ✓",
      description: `${taskName} ya había puntuado en este periodo, así que no suma otra vez.`,
    };
  }
  if (receipt.rescue && ownerName) {
    return {
      title: `✨ Rescate: +${receipt.points} para ${actorName}`,
      description: `${taskName} · ${ownerName} cede ${receipt.points} punto.`,
    };
  }
  return {
    title: CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]!,
    description: `Has ganado ${receipt.points} punto esta semana · ${taskName} · a nombre de ${actorName}`,
  };
}

function useRescueNotifications(
  completions: Completion[],
  people: Parameters<typeof ProfileView>[0]["people"],
  currentPerson: PersonId | null,
) {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const active = completions.filter((completion) => !completion.undoneAt);
    if (!seen.current) {
      seen.current = new Set(active.map((completion) => completion.id));
      return;
    }
    for (const completion of active) {
      if (seen.current.has(completion.id)) continue;
      seen.current.add(completion.id);
      if (
        !currentPerson ||
        completion.assignedPersonId !== currentPerson ||
        !isRescueCompletion(completion)
      ) {
        continue;
      }
      const actor = personById(people, completion.personId);
      toast.warning(`${actor.emoji} ${actor.label} ha rescatado una tarea tuya`, {
        description: "Has cedido 1 punto esta semana.",
      });
    }
  }, [completions, currentPerson, people]);
}

function Task({
  state,
  zone,
  ...props
}: {
  state: TaskState;
  zone: Zone | undefined;
  index: number;
  people: Parameters<typeof TaskCard>[0]["people"];
  person: PersonId;
  onDone: (id: string, occurrenceDate?: string) => void;
  onSkip: (id: string, occurrenceDate?: string) => void;
}) {
  return <TaskCard state={state} zoneLabel={zone?.label ?? state.task.zoneId} {...props} />;
}

function completionTimestampForState(state: TaskState): string {
  if (!state.occurrenceDate) return new Date().toISOString();
  const now = new Date();
  const yesterday = addDaysKey(localDateKey(now), -1);
  if (state.occurrenceDate !== yesterday) return now.toISOString();
  return new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString();
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="animate-rise-in">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
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

function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 pt-8">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="skeleton-warm h-28 rounded-2xl" />
      ))}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="text-5xl">🙀</p>
        <h1 className="mt-4 text-2xl font-semibold">Happy Home no consigue abrir la despensa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mongo no ha respondido. Puede ser solo un tropiezo.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}

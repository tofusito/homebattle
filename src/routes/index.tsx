import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Confetti } from "@/components/Confetti";
import { ActivityBell } from "@/components/ActivityBell";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { PersonPicker } from "@/components/PersonPicker";
import { PreferencesDialog } from "@/components/PreferencesDialog";
import { RescueDialog } from "@/components/RescueDialog";
import { SyncStatus } from "@/components/SyncStatus";
import { TodayView } from "@/components/TodayView";
import { useCleaningData, useLiveSync, useMarkDone, useUndo } from "@/hooks/use-cleaning-data";
import { useGentleReminders } from "@/hooks/use-reminders";
import { usePerson } from "@/hooks/use-person";
import { usePreferences } from "@/hooks/use-preferences";
import { usePushReminders } from "@/hooks/use-push-reminders";
import { useRescueNotifications } from "@/hooks/use-rescue-notifications";
import {
  buildGraceTaskStates,
  buildTaskStates,
  isTaskStateSatisfied,
  personById,
  requiresRescueConfirmation,
  taskStateKey,
  type TaskState,
} from "@/lib/cleaning";
import { completionFeedback, completionTimestampForState } from "@/lib/completion-feedback";
import { APP_NAME, APP_TAGLINE, greetingFor } from "@/lib/copy";
import { celebrateInteraction } from "@/lib/delight";
import { cn } from "@/lib/utils";

// Las pestañas que no son "Hoy" se cargan al entrar en ellas: recortan el
// bundle inicial y la primera pintura de la app.
const ProfileView = lazy(() =>
  import("@/components/ProfileView").then((m) => ({ default: m.ProfileView })),
);
const Scoreboard = lazy(() =>
  import("@/components/Scoreboard").then((m) => ({ default: m.Scoreboard })),
);
const ZonesView = lazy(() =>
  import("@/components/ZonesView").then((m) => ({ default: m.ZonesView })),
);

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

const LAST_TAB_KEY = "happy-home:last-tab";

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
  // Recupera la última pestaña tras montar (no en el init para no desajustar la hidratación).
  useEffect(() => {
    const saved = window.localStorage.getItem(LAST_TAB_KEY);
    if (saved === "zonas" || saved === "liga" || saved === "perfil") setTab(saved);
  }, []);
  const changeTab = (next: Tab) => {
    setTab(next);
    window.localStorage.setItem(LAST_TAB_KEY, next);
  };
  const [profileSection, setProfileSection] = useState<"rewards" | "history">("rewards");
  const [confetti, setConfetti] = useState(0);
  const [pendingRescueStateKey, setPendingRescueStateKey] = useState<string | null>(null);
  const markDone = useMarkDone();
  const undo = useUndo();
  const states = useMemo(
    () => buildTaskStates(data.tasks, data.completions),
    [data.tasks, data.completions],
  );
  const graceStates = useMemo(
    () => buildGraceTaskStates(data.tasks, data.completions),
    [data.tasks, data.completions],
  );
  const actionableStates = [...graceStates, ...states];
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
                  action: { label: "Ver", onClick: () => changeTab("perfil") },
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
                changeTab("perfil");
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
            <TodayView
              states={states}
              graceStates={graceStates}
              zones={data.zones}
              people={data.people}
              completions={data.completions}
              tasks={data.tasks}
              person={person}
              current={current}
              onDone={handleDone}
              onSkip={handleSkip}
              onOpenLiga={() => changeTab("liga")}
              onOpenZonas={() => changeTab("zonas")}
            />
          ) : tab === "zonas" ? (
            <Suspense fallback={<TabFallback />}>
              <ZonesView
                states={states}
                zones={data.zones}
                people={data.people}
                currentPerson={person}
                onDone={handleDone}
                onSkip={handleSkip}
              />
            </Suspense>
          ) : tab === "liga" ? (
            <Suspense fallback={<TabFallback />}>
              <Scoreboard
                completions={data.completions}
                people={data.people}
                tasks={data.tasks}
                zones={data.zones}
                settings={data.settings}
                rewards={data.rewards}
                currentPerson={person}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<TabFallback />}>
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
            </Suspense>
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

      <RescueDialog
        pendingRescue={pendingRescue}
        owner={pendingRescueOwner}
        actor={current}
        onCancel={() => setPendingRescueStateKey(null)}
        onConfirm={(state) => completeTask(state, true)}
      />

      <BottomNav tab={tab} onChange={changeTab} />
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

function TabFallback() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((index) => (
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

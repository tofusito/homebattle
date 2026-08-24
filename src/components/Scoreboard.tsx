import {
  Award,
  CalendarDays,
  Check,
  Crown,
  Flame,
  Gift,
  HeartHandshake,
  RefreshCw,
  Sparkles,
  Swords,
} from "lucide-react";
import { toast } from "sonner";

import { useWeeklyPrizeRefresh } from "@/hooks/use-cleaning-data";
import {
  completionsThisWeek,
  householdWeekProgress,
  householdWeekStreak,
  isRescueCompletion,
  leagueScores,
  rescueStats,
  startOfMonth,
  startOfWeek,
  type Completion,
  type HouseholdSettings,
  type LeagueScores,
  type Person,
  type PersonId,
  type RewardVoucher,
  type Task,
  type Zone,
  WEEKLY_DUEL_TARGET,
} from "@/lib/cleaning";
import { StatsSection } from "@/components/StatsSection";
import { streakCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function Scoreboard({
  completions,
  people,
  tasks,
  zones,
  settings,
  rewards,
  currentPerson,
}: {
  completions: Completion[];
  people: Person[];
  tasks: Task[];
  zones: Zone[];
  settings: HouseholdSettings;
  rewards: RewardVoucher[];
  currentPerson: PersonId;
}) {
  const weekStart = startOfWeek();
  const weekRows = completionsThisWeek(completions);
  const weekScores = leagueScores(completions, tasks, weekStart);
  const weekRescues = rescueStats(completions, tasks, weekStart);
  const monthScores = leagueScores(completions, tasks, startOfMonth());
  const leader = scoreLeader(weekScores);
  const { done, goal } = householdWeekProgress(completions, tasks);
  const sharedProgress = goal === 0 ? 0 : Math.min(100, (done / goal) * 100);
  const streak = householdWeekStreak(completions, tasks);
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const zoneCounts = zones
    .map((zone) => ({
      zone,
      count: weekRows.filter((row) => tasksById.get(row.taskId)?.zoneId === zone.id).length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const variety = Object.fromEntries(
    people.map((person) => [
      person.id,
      new Set(
        weekRows
          .filter((row) => row.personId === person.id)
          .map((row) => tasksById.get(row.taskId)?.zoneId)
          .filter(Boolean),
      ).size,
    ]),
  ) as Record<PersonId, number>;
  const history = recentWeekDuels(completions, tasks, 4);
  const wins = history.reduce<LeagueScores>(
    (result, row) => {
      const winner = scoreLeader(row.scores);
      if (winner) result[winner] += 1;
      return result;
    },
    { lucy: 0, manu: 0 },
  );
  const latestScoring = [...weekRows]
    .filter((row) => (tasksById.get(row.taskId)?.points ?? 0) > 0)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
  const activeZones = new Set(
    weekRows.map((row) => tasksById.get(row.taskId)?.zoneId).filter(Boolean),
  ).size;
  const challenges = [
    {
      label: "Los dos habéis participado",
      done: people.every((person) => weekRows.some((row) => row.personId === person.id)),
    },
    { label: "Habéis cuidado 3 zonas", done: activeZones >= 3 },
    { label: "Todas las tareas periódicas", done: goal > 0 && done >= goal },
  ];

  return (
    <section className="space-y-4">
      <div className="animate-rise-in duel-card relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="size-4 text-primary" />
            <h2 className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Liga del trapo · duelo semanal
            </h2>
          </div>
          <span className="rounded-full bg-card/75 px-2.5 py-1 text-xs font-bold text-primary">
            Primero a {WEEKLY_DUEL_TARGET}
          </span>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {people[0] ? (
            <DuelCompetitor
              person={people[0]}
              score={weekScores[people[0].id]}
              leading={leader === people[0].id}
            />
          ) : null}
          <div className="grid size-10 place-items-center rounded-full border border-border bg-card text-xs font-black text-muted-foreground shadow-sm">
            VS
          </div>
          {people[1] ? (
            <DuelCompetitor
              person={people[1]}
              score={weekScores[people[1].id]}
              leading={leader === people[1].id}
              align="right"
            />
          ) : null}
        </div>

        <p className="relative z-10 mt-5 text-center text-sm font-semibold">
          {duelCopy(weekScores, peopleById, latestScoring)}
        </p>
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-3">
          {people.slice(0, 2).map((person) => (
            <DuelTrack key={person.id} person={person} score={weekScores[person.id]} />
          ))}
        </div>
        <p className="relative z-10 mt-3 text-center text-xs text-muted-foreground">
          Cada tarea suma dentro de su límite: normalmente una vez al día, con las excepciones que
          se indican en su tarjeta.
        </p>
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-rescue/20 bg-rescue-soft/45 p-2.5">
          {people.slice(0, 2).map((person) => (
            <div key={person.id} className="text-center">
              <p className="text-xs font-bold text-rescue">
                ✨ {weekRescues[person.id].rescued}{" "}
                {weekRescues[person.id].rescued === 1 ? "rescate" : "rescates"}
              </p>
              <p className="text-xs text-muted-foreground">
                {weekRescues[person.id].conceded} cedidos · {person.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <WeeklyPrize
        settings={settings}
        people={people}
        currentPerson={currentPerson}
        locked={rewards.some((reward) => reward.weekKey === settings.weeklyRewardWeekKey)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard icon={CalendarDays} title="Temporada del mes">
          <div className="mt-4 flex items-end justify-between gap-3">
            {people.slice(0, 2).map((person) => (
              <div key={person.id} className="text-center">
                <p className="text-xl">{person.emoji}</p>
                <p
                  className={cn(
                    "text-3xl font-bold",
                    person.id === "lucy" ? "text-lucy" : "text-manu",
                  )}
                >
                  {monthScores[person.id]}
                </p>
                <p className="text-xs text-muted-foreground">{person.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {seasonCopy(monthScores, peopleById)}
          </p>
        </MetricCard>

        <MetricCard icon={Award} title="Duelos anteriores">
          <div className="mt-3 space-y-2">
            {history.map((row) => {
              const winner = scoreLeader(row.scores);
              return (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 text-muted-foreground">{row.label}</span>
                  <span className="font-bold text-lucy">{row.scores.lucy}</span>
                  <span className="text-muted-foreground">–</span>
                  <span className="font-bold text-manu">{row.scores.manu}</span>
                  <span className="w-8 text-right">
                    {winner ? peopleById.get(winner)?.emoji : "🤝"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Victorias: Lucy {wins.lucy} · Manu {wins.manu}
          </p>
        </MetricCard>
      </div>

      <div className="animate-rise-in goal-card rounded-3xl p-5 sm:p-6">
        <CardTitle icon={HeartHandshake}>Objetivo común · esta semana</CardTitle>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="font-display text-5xl leading-none font-semibold">
              {done}
              <span className="text-2xl text-muted-foreground">/{goal}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {done >= goal
                ? "Casa completada. Aquí ganáis los dos."
                : `Quedan ${goal - done} ocurrencias periódicas para cerrar juntos la semana.`}
            </p>
          </div>
          <span className="text-4xl" aria-hidden="true">
            🏡
          </span>
        </div>
        <div
          className="mt-5 h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Progreso del objetivo semanal compartido"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(done, goal)}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
            style={{ width: `${sharedProgress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Solo cuenta una vez cada comida, cena, turno diario o labor semanal prevista.
        </p>
      </div>

      <div className="animate-rise-in card-soft rounded-3xl p-5">
        <CardTitle icon={HeartHandshake}>Reto de equipo</CardTitle>
        <div className="mt-4 space-y-2">
          {challenges.map((challenge) => (
            <div
              key={challenge.label}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold",
                challenge.done ? "bg-fresh-soft text-fresh" : "bg-muted/60 text-muted-foreground",
              )}
            >
              <span className="grid size-7 place-items-center rounded-full bg-card/80">
                {challenge.done ? <Check className="size-4" /> : "·"}
              </span>
              {challenge.label}
            </div>
          ))}
        </div>
      </div>

      <div className="animate-rise-in card-soft rounded-3xl p-5">
        <CardTitle icon={Sparkles}>Ventajas de esta semana</CardTitle>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {people.slice(0, 2).map((person) => (
            <div
              key={person.id}
              className={cn(
                "rounded-2xl p-3",
                person.id === "lucy" ? "bg-lucy-soft/55" : "bg-manu-soft/55",
              )}
            >
              <p className="text-sm font-semibold">
                {person.emoji} {person.label}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {variety[person.id]}{" "}
                {variety[person.id] === 1 ? "zona distinta" : "zonas distintas"}
              </p>
              <p className="mt-1 text-xs font-semibold">{wins[person.id]} victorias recientes</p>
              <p className="mt-1 text-xs font-semibold text-rescue">
                {weekRescues[person.id].rescued}{" "}
                {weekRescues[person.id].rescued === 1 ? "rescate" : "rescates"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-rise-in card-soft rounded-3xl p-5">
        <CardTitle icon={Award}>Trofeos personales</CardTitle>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {personalAchievements(people, weekRows, tasksById, weekScores, weekRescues, variety).map(
            (achievement) => (
              <div
                key={`${achievement.owner.id}-${achievement.label}`}
                className={cn(
                  "rounded-2xl border px-3 py-3 transition-colors",
                  achievement.unlocked
                    ? achievement.owner.id === "lucy"
                      ? "border-lucy/25 bg-lucy-soft/55"
                      : "border-manu/25 bg-manu-soft/55"
                    : "border-border bg-muted/45 opacity-55 grayscale",
                )}
              >
                <span className="text-xl">{achievement.icon}</span>
                <p className="mt-1 text-xs font-semibold">{achievement.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {achievement.owner.emoji} {achievement.owner.label} · {achievement.detail}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      <WeeklyStory
        people={peopleById}
        scores={weekScores}
        rescues={weekRescues}
        topZone={zoneCounts[0]?.zone}
        done={done}
        goal={goal}
        prize={settings.weeklyPrize}
      />

      <div className="animate-rise-in card-soft rounded-3xl p-5">
        <CardTitle icon={Flame}>Racha de casa</CardTitle>
        <p className="font-display mt-3 text-4xl font-semibold">
          {streak} {streak === 1 ? "semana" : "semanas"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{streakCopy(streak)}</p>
        {zoneCounts[0] ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Esta semana la zona más cuidada es {zoneCounts[0].zone.label.toLowerCase()}.
          </p>
        ) : null}
      </div>

      <StatsSection completions={completions} tasks={tasks} zones={zones} people={people} />
    </section>
  );
}

function WeeklyPrize({
  settings,
  people,
  currentPerson,
  locked,
}: {
  settings: HouseholdSettings;
  people: Person[];
  currentPerson: PersonId;
  locked: boolean;
}) {
  const refresh = useWeeklyPrizeRefresh();
  const votes = settings.weeklyRefreshVotes ?? [];
  const hasVoted = votes.includes(currentPerson);
  const voter = people.find((person) => person.id === votes[0]);
  const other = people.find((person) => person.id !== votes[0]);
  const unavailable = locked || settings.weeklyRefreshUsed;

  return (
    <div className="animate-rise-in card-soft rounded-3xl border-soon/25 bg-soon-soft/35 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-soon">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
            Premio de la semana
          </p>
          <p className="mt-1 text-sm font-semibold">{settings.weeklyPrize}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {locked
              ? "Premio ganado y guardado como vale. El lunes aparecerá uno nuevo."
              : settings.weeklyRefreshUsed
                ? "Ya habéis usado el cambio consensuado de esta semana."
                : votes.length === 1
                  ? `${voter?.label ?? "Alguien"} ha pedido cambiarlo. Falta ${other?.label ?? "la otra persona"}.`
                  : "Se asigna cada lunes. Podéis cambiarlo una vez si los dos estáis de acuerdo."}
          </p>
          {!unavailable ? (
            <button
              type="button"
              disabled={refresh.isPending}
              onClick={() =>
                refresh.mutate(currentPerson, {
                  onSuccess: ({ refreshed, voted }) => {
                    if (refreshed) toast.success("🔄 Premio cambiado entre los dos");
                    else if (voted) toast("Cambio solicitado · 1/2");
                    else toast("Has retirado tu solicitud");
                  },
                  onError: () => toast.error("No se ha podido registrar el cambio"),
                })
              }
              className={cn(
                "mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors",
                hasVoted
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <RefreshCw className="size-3.5" />
              {hasVoted ? "Retirar mi voto" : "Pedir cambio"}
              <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-foreground">
                {votes.length}/2
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WeeklyStory({
  people,
  scores,
  rescues,
  topZone,
  done,
  goal,
  prize,
}: {
  people: Map<PersonId, Person>;
  scores: LeagueScores;
  rescues: Record<PersonId, { rescued: number; conceded: number }>;
  topZone: Zone | undefined;
  done: number;
  goal: number;
  prize: string;
}) {
  const leader = scoreLeader(scores);
  const rescuer = rescues.lucy.rescued >= rescues.manu.rescued ? "lucy" : "manu";
  return (
    <div className="animate-rise-in overflow-hidden rounded-3xl border border-primary/20 bg-primary p-5 text-primary-foreground shadow-sm">
      <p className="text-xs font-bold tracking-[0.14em] uppercase opacity-75">Crónica semanal</p>
      <h2 className="mt-2 text-2xl font-semibold">
        {leader ? `${people.get(leader)?.label} lleva la corona` : "La casa sigue en empate"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed opacity-90">
        Marcador {scores.lucy}–{scores.manu}. Habéis cerrado {done} de {goal} tareas periódicas
        {topZone ? ` y ${topZone.label.toLowerCase()} es la zona protagonista` : ""}.
      </p>
      {rescues[rescuer].rescued > 0 ? (
        <p className="mt-2 text-sm font-semibold">
          ✨ {people.get(rescuer)?.label} firma {rescues[rescuer].rescued}{" "}
          {rescues[rescuer].rescued === 1 ? "rescate" : "rescates"}.
        </p>
      ) : null}
      <div className="mt-4 rounded-2xl bg-card/15 p-3 text-xs font-semibold">🎁 {prize}</div>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  children,
}: {
  icon: typeof Award;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-rise-in card-soft rounded-3xl p-5">
      <CardTitle icon={icon}>{title}</CardTitle>
      {children}
    </div>
  );
}

function CardTitle({ icon: Icon, children }: { icon: typeof Award; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {children}
      </h2>
    </div>
  );
}

function DuelTrack({ person, score }: { person: Person; score: number }) {
  return (
    <div>
      <div
        className="grid grid-cols-10 gap-1"
        aria-label={`${person.label}: ${score} de ${WEEKLY_DUEL_TARGET} puntos`}
      >
        {Array.from({ length: WEEKLY_DUEL_TARGET }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 rounded-full",
              index < score ? (person.id === "lucy" ? "bg-lucy" : "bg-manu") : "bg-foreground/10",
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        {Math.max(0, WEEKLY_DUEL_TARGET - score)} para llegar
      </p>
    </div>
  );
}

function DuelCompetitor({
  person,
  score,
  leading,
  align = "left",
}: {
  person: Person;
  score: number;
  leading: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={cn(align === "right" && "text-right")}>
      <div className={cn("flex items-center gap-1.5", align === "right" && "justify-end")}>
        <span className="text-2xl">{person.emoji}</span>
        <p className="text-sm font-bold">{person.label}</p>
        {leading ? <Crown className="size-4 fill-soon text-soon" /> : null}
      </div>
      <p
        className={cn(
          "font-display mt-1 text-6xl leading-none font-semibold",
          person.id === "lucy" ? "text-lucy" : "text-manu",
        )}
      >
        {score}
      </p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {score === 1 ? "punto" : "puntos"}
      </p>
    </div>
  );
}

function scoreLeader(scores: LeagueScores): PersonId | null {
  if (scores.lucy === scores.manu) return null;
  return scores.lucy > scores.manu ? "lucy" : "manu";
}

function duelCopy(
  scores: LeagueScores,
  people: Map<PersonId, Person>,
  latest?: Completion,
): string {
  const leader = scoreLeader(scores);
  if (!leader) {
    return scores.lucy === 0
      ? "La corona está libre. La primera tarea competitiva abre el duelo."
      : `Empate a ${scores.lucy}. La siguiente tarea puede romperlo.`;
  }
  const difference = Math.abs(scores.lucy - scores.manu);
  if (latest && isRescueCompletion(latest)) {
    return `Un rescate ha movido el tablero: ${people.get(leader)?.label} manda por ${difference}.`;
  }
  if (latest?.personId === leader && difference === 1) {
    return `${people.get(leader)?.label} acaba de ponerse uno por delante.`;
  }
  return `${people.get(leader)?.label} lleva la corona por ${difference} ${difference === 1 ? "punto" : "puntos"}.`;
}

function seasonCopy(scores: LeagueScores, people: Map<PersonId, Person>): string {
  const leader = scoreLeader(scores);
  if (!leader)
    return scores.lucy === 0 ? "La temporada aún no ha empezado." : "Temporada empatada.";
  return `${people.get(leader)?.label} lidera el mes por ${Math.abs(scores.lucy - scores.manu)}.`;
}

function personalAchievements(
  people: Person[],
  rows: Completion[],
  tasks: Map<string, Task>,
  scores: LeagueScores,
  rescues: Record<PersonId, { rescued: number; conceded: number }>,
  variety: Record<PersonId, number>,
) {
  return people.flatMap((person) => {
    const ownRows = rows.filter((row) => row.personId === person.id);
    const laundry = ownRows.filter((row) => tasks.get(row.taskId)?.zoneId === "ropa").length;
    const litter = ownRows.filter((row) => row.taskId === "gatos_arenero").length;
    return [
      {
        owner: person,
        icon: "🗺️",
        label: "Todoterreno",
        detail: "3 zonas distintas",
        unlocked: variety[person.id] >= 3,
      },
      {
        owner: person,
        icon: "✨",
        label: "Salvavidas",
        detail: "Primer rescate",
        unlocked: rescues[person.id].rescued >= 1,
      },
      {
        owner: person,
        icon: laundry >= litter ? "🧺" : "🐾",
        label: laundry >= litter ? "Domador de lavadoras" : "Guardián del arenero",
        detail: laundry >= litter ? "2 tareas de ropa" : "2 turnos de arenero",
        unlocked: Math.max(laundry, litter) >= 2 || scores[person.id] >= 5,
      },
    ];
  });
}

function recentWeekDuels(completions: Completion[], tasks: Task[], count: number) {
  const current = startOfWeek();
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(current);
    start.setDate(start.getDate() - (index + 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      label: new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(start),
      scores: leagueScores(completions, tasks, start, end),
    };
  });
}

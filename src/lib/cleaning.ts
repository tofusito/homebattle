export type PersonId = "lucy" | "manu";
export type DayPeriod = "lunch" | "evening";
export const WEEKLY_DUEL_TARGET = 30;

export interface Person {
  id: PersonId;
  label: string;
  emoji: string;
  color: "lucy" | "manu";
}

export interface Zone {
  id: string;
  label: string;
  tagline: string;
  sortOrder: number;
}

export type Schedule =
  | { type: "on_demand" }
  | { type: "on_demand_weekly"; anchorDate: string; firstAssignee: PersonId }
  | { type: "daily"; anchorDate: string; firstAssignee: PersonId; preferredPeriod?: DayPeriod }
  | {
      type: "two_day_block";
      anchorDate: string;
      firstAssignee: PersonId;
      preferredPeriod?: DayPeriod;
    }
  | {
      type: "weekly";
      anchorDate: string;
      firstAssignee: PersonId;
      rotationGroup?: string;
      dueDay?: "sunday";
    }
  | { type: "monthly_first_sunday"; anchorDate: string; firstAssignee: PersonId }
  | { type: "linked"; sourceTaskId: string; anchorDate?: string };

export interface Task {
  id: string;
  zoneId: string;
  name: string;
  detail: string;
  schedule: Schedule;
  sortOrder: number;
  points: number;
  maxScoredCompletionsPerPeriod?: number;
  unlimitedScoring?: boolean;
  archived?: boolean;
}

export interface Completion {
  id: string;
  taskId: string;
  personId: PersonId;
  assignedPersonId?: PersonId;
  completedAt: string;
  recordedAt?: string;
  editedAt?: string;
  skipped?: boolean;
  undoneAt?: string;
  reportedPeriod?: string;
  waivedByRewardId?: string;
  waivedOwnerId?: PersonId;
}

export interface CleaningData {
  people: Person[];
  zones: Zone[];
  tasks: Task[];
  completions: Completion[];
  settings: HouseholdSettings;
  rewards: RewardVoucher[];
}

export interface HouseholdSettings {
  weeklyPrize: string;
  weeklyRewardId: string;
  weeklyRewardWeekKey: string;
  weeklyRefreshVotes?: PersonId[];
  weeklyRefreshUsed?: boolean;
  updatedAt?: string;
}

export interface RewardVoucher {
  id: string;
  rewardId: string;
  title: string;
  emoji: string;
  earnedBy: PersonId;
  weekKey: string;
  earnedAt: string;
  redeemedAt?: string;
  consumedAt?: string;
  consumedCompletionId?: string;
}

export type Status = "fresh" | "later" | "soon" | "late" | "on_demand";

export interface TaskState {
  task: Task;
  last: Completion | null;
  status: Status;
  assignedTo: PersonId | null;
  progress: number;
  dueLabel: string;
  completionCount?: number;
  completionLimit?: number;
  rotationLabel?: string;
  triggeredBy?: PersonId;
  occurrenceDate?: string;
  grace?: boolean;
}

export interface LeagueScores {
  lucy: number;
  manu: number;
}

export type ScoreReceiptReason = "scored" | "repeated" | "non_competitive";

export interface ScoreReceipt {
  scored: boolean;
  reason: ScoreReceiptReason;
  points: number;
  actorDelta: number;
  ownerDelta: number;
  rescue: boolean;
  waived: boolean;
}

export interface HouseholdProgress {
  done: number;
  goal: number;
}

export interface WeeklyWinner {
  personId: PersonId;
  wonAt: string;
}

export type RescueStats = Record<PersonId, { rescued: number; conceded: number }>;

const DAY = 86_400_000;

export function localDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function madridTimeKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("hour")}:${value("minute")}`;
}

function madridOffsetAt(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (
    Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    ) - date.getTime()
  );
}

export function madridDateTimeToIso(dateKey: string, timeKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{2}:\d{2}$/.test(timeKey)) {
    throw new Error("Invalid Madrid date or time");
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeKey.split(":").map(Number);
  const wallClock = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let instant = wallClock;
  for (let index = 0; index < 2; index += 1) {
    instant = wallClock - madridOffsetAt(new Date(instant));
  }
  return new Date(instant).toISOString();
}

function dayNumber(dateKey: string): number {
  return Math.floor(Date.parse(`${dateKey}T12:00:00Z`) / DAY);
}

function daysBetween(anchor: string, current: string): number {
  return dayNumber(current) - dayNumber(anchor);
}

function opposite(person: PersonId): PersonId {
  return person === "lucy" ? "manu" : "lucy";
}

function latestCompletionForTask(
  completions: Completion[],
  taskId: string,
  before = new Date(),
): Completion | null {
  const beforeTime = before.getTime();
  let latest: Completion | null = null;
  for (const completion of completions) {
    if (completion.taskId !== taskId || completion.undoneAt || completion.skipped) continue;
    const completedTime = new Date(completion.completedAt).getTime();
    if (completedTime > beforeTime) continue;
    if (!latest || completedTime > new Date(latest.completedAt).getTime()) latest = completion;
  }
  return latest;
}

function latestLinkedSourceCompletion(
  task: Task,
  completions: Completion[],
  before = new Date(),
): Completion | null {
  if (task.schedule.type !== "linked") return null;
  const source = latestCompletionForTask(completions, task.schedule.sourceTaskId, before);
  if (
    source &&
    task.schedule.anchorDate &&
    localDateKey(new Date(source.completedAt)) < task.schedule.anchorDate
  ) {
    return null;
  }
  return source;
}

export function mondayKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function isSundayKey(dateKey: string): boolean {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay() === 0;
}

export function addDaysKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function friendlyDate(dateKey: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function firstSunday(dateKey: string): string {
  const [year, month] = dateKey.split("-").map(Number);
  const first = new Date(Date.UTC(year!, month! - 1, 1, 12));
  const offset = (7 - first.getUTCDay()) % 7;
  first.setUTCDate(1 + offset);
  return first.toISOString().slice(0, 10);
}

function isCompletedInPeriod(last: Completion | null, startKey: string, endKey?: string): boolean {
  if (!last) return false;
  const key = localDateKey(new Date(last.completedAt));
  return key >= startKey && (endKey === undefined || key <= endKey);
}

function assigneeFor(schedule: Schedule, today: string, tasks: Task[]): PersonId | null {
  if (schedule.type === "on_demand") return null;
  if (schedule.type === "linked") return null;
  const elapsed = Math.max(0, daysBetween(schedule.anchorDate, today));
  if (schedule.type === "daily") {
    return elapsed % 2 === 0 ? schedule.firstAssignee : opposite(schedule.firstAssignee);
  }
  if (schedule.type === "two_day_block") {
    return Math.floor(elapsed / 2) % 2 === 0
      ? schedule.firstAssignee
      : opposite(schedule.firstAssignee);
  }
  if (schedule.type === "on_demand_weekly") {
    if (today < schedule.anchorDate) return schedule.firstAssignee;
    const weeks = Math.floor(daysBetween(mondayKey(schedule.anchorDate), mondayKey(today)) / 7);
    return weeks % 2 === 0 ? schedule.firstAssignee : opposite(schedule.firstAssignee);
  }
  if (schedule.type === "weekly") {
    const weeks = Math.floor(daysBetween(mondayKey(schedule.anchorDate), mondayKey(today)) / 7);
    return weeks % 2 === 0 ? schedule.firstAssignee : opposite(schedule.firstAssignee);
  }
  if (today < schedule.anchorDate) return schedule.firstAssignee;
  const anchorMonth =
    Number(schedule.anchorDate.slice(0, 4)) * 12 + Number(schedule.anchorDate.slice(5, 7));
  const currentMonth = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7));
  return (currentMonth - anchorMonth) % 2 === 0
    ? schedule.firstAssignee
    : opposite(schedule.firstAssignee);
}

export function assignedPersonForTask(
  task: Task,
  tasks: Task[],
  date = new Date(),
  completions: Completion[] = [],
): PersonId | null {
  if (task.schedule.type === "linked") {
    const sourceCompletion = latestLinkedSourceCompletion(task, completions, date);
    return sourceCompletion ? opposite(sourceCompletion.personId) : null;
  }
  return assigneeFor(task.schedule, localDateKey(date), tasks);
}

function rotationLabel(
  schedule: Schedule,
  today: string,
  assignedTo: PersonId | null,
): string | undefined {
  if (!assignedTo || schedule.type === "on_demand" || schedule.type === "linked") return undefined;
  const next = opposite(assignedTo);
  if (schedule.type === "daily") return `Mañana pasa a ${next === "lucy" ? "Lucy" : "Manu"}`;
  if (schedule.type === "two_day_block") {
    const elapsed = Math.max(0, daysBetween(schedule.anchorDate, today));
    const nextBlock = addDaysKey(schedule.anchorDate, (Math.floor(elapsed / 2) + 1) * 2);
    return `Cambia a ${next === "lucy" ? "Lucy" : "Manu"} el ${friendlyDate(nextBlock)}`;
  }
  if (schedule.type === "weekly" || schedule.type === "on_demand_weekly") {
    const nextMonday = addDaysKey(mondayKey(today), 7);
    return `La próxima semana: ${next === "lucy" ? "Lucy" : "Manu"} · ${friendlyDate(nextMonday)}`;
  }
  const [year, month] = today.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year!, month!, 1, 12)).toISOString().slice(0, 10);
  return `El próximo mes: ${next === "lucy" ? "Lucy" : "Manu"} · ${friendlyDate(firstSunday(nextMonth))}`;
}

export function buildTaskStates(tasks: Task[], completions: Completion[]): TaskState[] {
  const valid = completions.filter((completion) => !completion.undoneAt);
  const lastByTask = new Map<string, Completion>();
  for (const completion of valid) {
    const previous = lastByTask.get(completion.taskId);
    if (!previous || completion.completedAt > previous.completedAt) {
      lastByTask.set(completion.taskId, completion);
    }
  }

  const today = localDateKey();
  const completionCountTodayByTask = new Map<string, number>();
  for (const completion of valid) {
    if (localDateKey(new Date(completion.completedAt)) !== today) continue;
    completionCountTodayByTask.set(
      completion.taskId,
      (completionCountTodayByTask.get(completion.taskId) ?? 0) + 1,
    );
  }
  const nowHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );

  return tasks
    .filter((task) => !task.archived)
    .map((task): TaskState => {
      const last = lastByTask.get(task.id) ?? null;
      const assignedTo = assignedPersonForTask(task, tasks, new Date(), valid);
      const nextRotation = rotationLabel(task.schedule, today, assignedTo);
      if (task.schedule.type === "on_demand") {
        const completedToday = completionCountTodayByTask.get(task.id) ?? 0;
        const dailyLimit = task.maxScoredCompletionsPerPeriod ?? 1;
        const dailyLimitReached = !task.unlimitedScoring && completedToday >= dailyLimit;
        return {
          task,
          last,
          assignedTo,
          status: dailyLimitReached ? "fresh" : "on_demand",
          progress: 0,
          completionCount: completedToday,
          ...(!task.unlimitedScoring ? { completionLimit: dailyLimit } : {}),
          dueLabel: dailyLimitReached
            ? dailyLimit > 1
              ? `${dailyLimit}/${dailyLimit} hechas hoy`
              : "Hecha hoy"
            : dailyLimit > 1 && completedToday > 0
              ? `${completedToday}/${dailyLimit} hechas hoy`
              : task.unlimitedScoring
                ? "A demanda · cada vez suma 1 punto"
                : "A demanda",
        };
      }

      if (task.schedule.type === "linked") {
        const sourceLast = latestLinkedSourceCompletion(task, valid);
        const waiting = Boolean(
          sourceLast && (!last || new Date(last.completedAt) < new Date(sourceLast.completedAt)),
        );
        const isKitchenHandoff = task.zoneId === "cocina";
        const isRagHandoff = task.id === "ropa_recoger_trapos";
        return {
          task,
          last,
          assignedTo,
          ...(sourceLast ? { triggeredBy: sourceLast.personId } : {}),
          status: !sourceLast ? "on_demand" : waiting ? "soon" : "fresh",
          progress: waiting ? 0.8 : 0,
          dueLabel: !sourceLast
            ? isKitchenHandoff
              ? "Primero hay que cocinar"
              : "Primero hay que lavar y tender"
            : waiting
              ? isKitchenHandoff
                ? "Lista para recoger"
                : isRagHandoff
                  ? "Lista para recoger y guardar"
                  : "Lista para recoger y doblar"
              : isKitchenHandoff
                ? "Cocina recogida"
                : isRagHandoff
                  ? "Recogidos y guardados"
                  : "Recogida y doblada",
        };
      }

      if (task.schedule.type === "on_demand_weekly") {
        const done = isCompletedInPeriod(last, mondayKey(today));
        return {
          task,
          last,
          assignedTo,
          status: "on_demand",
          progress: 0,
          dueLabel: done ? "Hecha esta semana · a demanda" : "Mínimo una vez esta semana",
          ...(nextRotation ? { rotationLabel: nextRotation } : {}),
        };
      }

      if (task.schedule.type === "weekly") {
        const done = isCompletedInPeriod(last, mondayKey(today));
        const dueToday = task.schedule.dueDay === "sunday" && isSundayKey(today);
        return {
          task,
          last,
          assignedTo,
          status: done ? "fresh" : dueToday ? "soon" : "later",
          progress: done ? 0 : dueToday ? 0.8 : 0.25,
          dueLabel: done
            ? "Hecha esta semana"
            : task.schedule.dueDay === "sunday"
              ? dueToday
                ? "Toca hoy"
                : "Este domingo"
              : "Toca esta semana",
          ...(nextRotation ? { rotationLabel: nextRotation } : {}),
        };
      }

      if (task.schedule.type === "monthly_first_sunday") {
        if (today < task.schedule.anchorDate) {
          return {
            task,
            last,
            assignedTo,
            status: "soon",
            progress: 0.2,
            dueLabel: `Empieza el ${task.schedule.anchorDate}`,
            ...(nextRotation ? { rotationLabel: nextRotation } : {}),
          };
        }
        const due = firstSunday(today);
        const done = isCompletedInPeriod(last, `${monthKey(today)}-01`);
        const status: Status = done ? "fresh" : today >= due ? "late" : "soon";
        return {
          task,
          last,
          assignedTo,
          status,
          progress: done ? 0 : status === "late" ? 1 : 0.55,
          dueLabel: done
            ? "Hecha este mes"
            : today >= due
              ? "Pendiente este mes"
              : `Toca el ${due}`,
          ...(nextRotation ? { rotationLabel: nextRotation } : {}),
        };
      }

      const doneToday = isCompletedInPeriod(last, today, today);
      const preferredPeriod =
        "preferredPeriod" in task.schedule ? task.schedule.preferredPeriod : undefined;
      let status: Status;
      let dueLabel: string;
      if (doneToday) {
        status = "fresh";
        dueLabel = last?.skipped
          ? task.id === "cocina_comida"
            ? "Hoy no se come en casa"
            : "Hoy no se cena en casa"
          : "Hecha hoy";
      } else if (preferredPeriod === "lunch") {
        status = nowHour < 11 ? "later" : nowHour < 16 ? "soon" : "late";
        dueLabel =
          nowHour < 11
            ? "A mediodía"
            : nowHour < 16
              ? "Toca antes de las 16:00"
              : "Pendiente desde la comida";
      } else if (preferredPeriod === "evening") {
        status = nowHour < 18 ? "later" : nowHour < 22 ? "soon" : "late";
        dueLabel =
          nowHour < 18
            ? "Esta noche"
            : nowHour < 22
              ? "Toca esta noche"
              : "Pendiente de esta noche";
      } else {
        status = nowHour < 20 ? "soon" : "late";
        dueLabel = "Toca hoy";
      }
      return {
        task,
        last,
        assignedTo,
        status,
        progress: doneToday ? 0 : status === "late" ? 1 : status === "soon" ? 0.7 : 0.35,
        dueLabel,
        ...(nextRotation ? { rotationLabel: nextRotation } : {}),
      };
    })
    .sort((a, b) => b.progress - a.progress || a.task.sortOrder - b.task.sortOrder);
}

/**
 * Keeps one missed daily occurrence actionable throughout the following day.
 * The occurrence remains separate from today's card so its assignment, score,
 * and history date are preserved.
 */
export function buildGraceTaskStates(
  tasks: Task[],
  completions: Completion[],
  date = new Date(),
): TaskState[] {
  const today = localDateKey(date);
  const yesterday = addDaysKey(today, -1);
  const valid = completions.filter((completion) => !completion.undoneAt);

  return tasks
    .filter(
      (task) =>
        !task.archived &&
        (((task.schedule.type === "daily" || task.schedule.type === "two_day_block") &&
          task.schedule.anchorDate <= yesterday) ||
          (task.schedule.type === "weekly" &&
            task.schedule.dueDay === "sunday" &&
            isSundayKey(yesterday))),
    )
    .filter((task) => {
      if (task.schedule.type === "weekly" && task.schedule.dueDay === "sunday") {
        const previousWeekStart = mondayKey(yesterday);
        return !valid.some((completion) => {
          const completedDate = localDateKey(new Date(completion.completedAt));
          return (
            completion.taskId === task.id &&
            completedDate >= previousWeekStart &&
            completedDate <= yesterday
          );
        });
      }
      return !valid.some(
        (completion) =>
          completion.taskId === task.id &&
          localDateKey(new Date(completion.completedAt)) === yesterday,
      );
    })
    .map((task): TaskState => ({
      task,
      last: null,
      assignedTo: assignedPersonForTask(
        task,
        tasks,
        new Date(`${yesterday}T12:00:00+02:00`),
        valid,
      ),
      status: "late",
      progress: 1,
      dueLabel: "Pendiente de ayer · disponible hasta las 23:59",
      occurrenceDate: yesterday,
      grace: true,
    }))
    .sort((a, b) => a.task.sortOrder - b.task.sortOrder);
}

export function taskStateKey(state: TaskState): string {
  return state.occurrenceDate ? `${state.task.id}:${state.occurrenceDate}` : state.task.id;
}

export function personById(people: Person[], id: PersonId): Person {
  return people.find((person) => person.id === id) ?? people[0]!;
}

export function isTodayTask(state: TaskState): boolean {
  return (
    state.task.schedule.type === "daily" ||
    state.task.schedule.type === "two_day_block" ||
    (state.task.schedule.type === "weekly" &&
      state.task.schedule.dueDay === "sunday" &&
      isSundayKey(localDateKey())) ||
    (state.task.schedule.type === "linked" &&
      state.assignedTo !== null &&
      !isTaskStateSatisfied(state))
  );
}

export function isOnDemandTask(state: TaskState): boolean {
  return (
    state.task.schedule.type === "on_demand" || state.task.schedule.type === "on_demand_weekly"
  );
}

export function isWeeklyOverviewTask(state: TaskState): boolean {
  return (
    state.task.schedule.type === "weekly" || state.task.schedule.type === "monthly_first_sunday"
  );
}

export function isRescueCompletion(completion: Completion): boolean {
  return Boolean(
    !completion.skipped &&
    completion.assignedPersonId &&
    completion.assignedPersonId !== completion.personId,
  );
}

export function isTaskStateSatisfied(state: TaskState): boolean {
  return state.status === "fresh" || state.dueLabel.startsWith("Hecha");
}

export function isRescueState(state: TaskState): boolean {
  return Boolean(state.last && isTaskStateSatisfied(state) && isRescueCompletion(state.last));
}

export function requiresRescueConfirmation(
  state: TaskState,
  actor: PersonId,
  rewards: RewardVoucher[],
): boolean {
  if (
    state.task.points <= 0 ||
    !state.assignedTo ||
    state.assignedTo === actor ||
    isTaskStateSatisfied(state)
  ) {
    return false;
  }
  const ownerHasActiveWaiver = rewards.some(
    (reward) =>
      reward.rewardId === "skip-next-task" &&
      reward.earnedBy === state.assignedTo &&
      Boolean(reward.redeemedAt) &&
      !reward.consumedAt,
  );
  return !ownerHasActiveWaiver;
}

export function weeklyGoal(tasks: Task[], date = new Date()): number {
  const current = localDateKey(date);
  const weekStart = mondayKey(current);
  return tasks.reduce((total, task) => {
    if (task.archived) return total;
    if (task.schedule.type === "daily" || task.schedule.type === "two_day_block") return total + 7;
    if (task.schedule.type === "weekly" || task.schedule.type === "on_demand_weekly")
      return total + 1;
    if (task.schedule.type === "monthly_first_sunday") {
      const hasMonthlySunday = Array.from({ length: 7 }, (_, index) =>
        addDaysKey(weekStart, index),
      ).some((day) => firstSunday(day) === day);
      return hasMonthlySunday ? total + 1 : total;
    }
    return total;
  }, 0);
}

export function completionsThisWeek(completions: Completion[], date = new Date()): Completion[] {
  const since = startOfWeek(date).getTime();
  return completions.filter(
    (completion) =>
      !completion.undoneAt &&
      !completion.skipped &&
      new Date(completion.completedAt).getTime() >= since,
  );
}

function leagueBucket(task: Task, completion: Completion): string {
  const dateKey = localDateKey(new Date(completion.completedAt));
  if (task.schedule.type === "weekly" || task.schedule.type === "on_demand_weekly") {
    return mondayKey(dateKey);
  }
  if (task.schedule.type === "monthly_first_sunday") return monthKey(dateKey);
  return dateKey;
}

function isRequiredTask(task: Task, weekKey: string): boolean {
  if (task.archived) return false;
  if (
    task.schedule.type === "daily" ||
    task.schedule.type === "two_day_block" ||
    task.schedule.type === "weekly" ||
    task.schedule.type === "on_demand_weekly"
  ) {
    return true;
  }
  if (task.schedule.type !== "monthly_first_sunday") return false;
  return Array.from({ length: 7 }, (_, index) => addDaysKey(weekKey, index)).some(
    (day) => firstSunday(day) === day,
  );
}

/**
 * Counts distinct recurring task occurrences only. Free-form on-demand work and
 * repeated completions remain useful history, but cannot fill the shared goal.
 */
export function householdWeekProgress(
  completions: Completion[],
  tasks: Task[],
  date = new Date(),
): HouseholdProgress {
  const weekKey = mondayKey(localDateKey(date));
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const occurrences = new Set<string>();

  for (const completion of completions) {
    if (completion.undoneAt) continue;
    const completionWeek = mondayKey(localDateKey(new Date(completion.completedAt)));
    if (completionWeek !== weekKey) continue;
    const task = tasksById.get(completion.taskId);
    if (!task || !isRequiredTask(task, weekKey)) continue;
    occurrences.add(`${task.id}:${leagueBucket(task, completion)}`);
  }

  return { done: occurrences.size, goal: weeklyGoal(tasks, date) };
}

export function scoreReceiptForCompletion(
  completion: Completion,
  completions: Completion[],
  tasks: Task[],
): ScoreReceipt {
  const task = tasks.find((candidate) => candidate.id === completion.taskId);
  const rescue = isRescueCompletion(completion);
  const waived = Boolean(completion.waivedByRewardId);
  if (!task || task.points <= 0 || completion.skipped) {
    return {
      scored: false,
      reason: "non_competitive",
      points: 0,
      actorDelta: 0,
      ownerDelta: 0,
      rescue,
      waived,
    };
  }

  const bucket = leagueBucket(task, completion);
  const bucketRows = completions
    .filter(
      (candidate) =>
        !candidate.undoneAt &&
        candidate.taskId === task.id &&
        leagueBucket(task, candidate) === bucket,
    )
    .sort((a, b) => {
      const difference = new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      return difference || a.id.localeCompare(b.id);
    });
  const scoringPosition = bucketRows.findIndex((candidate) => candidate.id === completion.id);
  const scoringLimit = task.unlimitedScoring
    ? Number.POSITIVE_INFINITY
    : (task.maxScoredCompletionsPerPeriod ?? 1);
  if (scoringPosition === -1 || scoringPosition >= scoringLimit) {
    return {
      scored: false,
      reason: "repeated",
      points: task.points,
      actorDelta: 0,
      ownerDelta: 0,
      rescue,
      waived,
    };
  }

  return {
    scored: true,
    reason: "scored",
    points: task.points,
    actorDelta: task.points,
    ownerDelta: rescue ? -task.points : 0,
    rescue,
    waived,
  };
}

function scoringRows(
  completions: Completion[],
  tasks: Task[],
  since: Date,
  until?: Date,
): Array<{ completion: Completion; task: Task }> {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const occurrenceCounts = new Map<string, number>();
  const sinceTime = since.getTime();
  const untilTime = until?.getTime();
  const rows = completions
    .filter((completion) => {
      const time = new Date(completion.completedAt).getTime();
      return (
        !completion.undoneAt &&
        !completion.skipped &&
        time >= sinceTime &&
        (untilTime === undefined || time < untilTime)
      );
    })
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
  const scoring: Array<{ completion: Completion; task: Task }> = [];

  for (const completion of rows) {
    const task = tasksById.get(completion.taskId);
    if (!task || task.archived || task.points <= 0) continue;
    const occurrence = `${task.id}:${leagueBucket(task, completion)}`;
    const count = occurrenceCounts.get(occurrence) ?? 0;
    const scoringLimit = task.unlimitedScoring
      ? Number.POSITIVE_INFINITY
      : (task.maxScoredCompletionsPerPeriod ?? 1);
    if (count >= scoringLimit) continue;
    occurrenceCounts.set(occurrence, count + 1);
    scoring.push({ completion, task });
  }
  return scoring;
}

export function weeklyWinner(
  completions: Completion[],
  tasks: Task[],
  since: Date,
  target: number,
): WeeklyWinner | null {
  const scores: LeagueScores = { lucy: 0, manu: 0 };
  for (const { completion, task } of scoringRows(completions, tasks, since)) {
    scores[completion.personId] += task.points;
    if (isRescueCompletion(completion)) scores[completion.assignedPersonId!] -= task.points;
    if (scores[completion.personId] >= target) {
      return { personId: completion.personId, wonAt: completion.completedAt };
    }
  }
  return null;
}

/**
 * Counts valid completions up to each task's period cap. Repeating an on-demand
 * task can remain useful history, but it cannot be farmed beyond that cap.
 */
export function leagueScores(
  completions: Completion[],
  tasks: Task[],
  since: Date,
  until?: Date,
): LeagueScores {
  const scores: LeagueScores = { lucy: 0, manu: 0 };

  for (const { completion, task } of scoringRows(completions, tasks, since, until)) {
    scores[completion.personId] += task.points;
    if (isRescueCompletion(completion)) {
      scores[completion.assignedPersonId!] -= task.points;
    }
  }
  return scores;
}

export function rescueStats(
  completions: Completion[],
  tasks: Task[],
  since: Date,
  until?: Date,
): RescueStats {
  const stats: RescueStats = {
    lucy: { rescued: 0, conceded: 0 },
    manu: { rescued: 0, conceded: 0 },
  };
  for (const { completion } of scoringRows(completions, tasks, since, until)) {
    if (!isRescueCompletion(completion)) continue;
    stats[completion.personId].rescued += 1;
    stats[completion.assignedPersonId!].conceded += 1;
  }
  return stats;
}

export function householdWeekStreak(
  completions: Completion[],
  tasks: Task[],
  date = new Date(),
): number {
  let cursor = mondayKey(localDateKey(date));
  const progressAt = (weekKey: string) =>
    householdWeekProgress(completions, tasks, new Date(`${weekKey}T12:00:00+02:00`));
  let progress = progressAt(cursor);
  if (progress.goal === 0 || progress.done < progress.goal) {
    cursor = addDaysKey(cursor, -7);
    progress = progressAt(cursor);
  }
  let streak = 0;
  while (progress.goal > 0 && progress.done >= progress.goal) {
    streak += 1;
    cursor = addDaysKey(cursor, -7);
    progress = progressAt(cursor);
  }
  return streak;
}

export function formatWhen(iso: string, reportedPeriod?: string): string {
  if (reportedPeriod) return `${reportedPeriod} (día sin confirmar)`;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 2) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function formatHistoryWhen(iso: string, date = new Date()): string {
  const completed = new Date(iso);
  const completedKey = localDateKey(completed);
  const today = localDateKey(date);
  const yesterday = addDaysKey(today, -1);
  const time = madridTimeKey(completed);
  if (completedKey === today) return `Hoy, ${time}`;
  if (completedKey === yesterday) return `Ayer, ${time}`;
  const day = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
  }).format(completed);
  return `${day}, ${time}`;
}

export function startOfWeek(date = new Date()): Date {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day);
  return result;
}

export function startOfMonth(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(1);
  return result;
}

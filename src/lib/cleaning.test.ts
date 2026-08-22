import { afterAll, beforeAll, describe, expect, setSystemTime, test } from "bun:test";

import {
  assignedPersonForTask,
  buildGraceTaskStates,
  buildTaskStates,
  householdWeekStreak,
  householdWeekProgress,
  isOnDemandTask,
  isRescueCompletion,
  isRescueState,
  isTodayTask,
  leagueScores,
  localDateKey,
  madridDateTimeToIso,
  madridTimeKey,
  mondayKey,
  rescueStats,
  requiresRescueConfirmation,
  scoreReceiptForCompletion,
  weeklyGoal,
  weeklyWinner,
  WEEKLY_DUEL_TARGET,
  type Completion,
} from "./cleaning";
import { TASKS } from "../server/seed";

describe("household rotations", () => {
  beforeAll(() => setSystemTime(new Date("2026-08-08T19:00:00+02:00")));
  afterAll(() => setSystemTime());

  test("starts with the user-provided assignments", () => {
    const states = buildTaskStates(TASKS, []);
    expect(states.find((row) => row.task.id === "cocina_comida")?.assignedTo).toBe("manu");
    expect(states.find((row) => row.task.id === "cocina_cena")?.assignedTo).toBe("lucy");
    expect(states.find((row) => row.task.id === "cocina_suelo")?.assignedTo).toBe("lucy");
    expect(states.find((row) => row.task.id === "gatos_arenero")?.assignedTo).toBe("manu");
    expect(states.find((row) => row.task.id === "habitacion_sabanas")?.dueLabel).toBe(
      "A demanda · cada vez suma 1 punto",
    );
    expect(states.find((row) => row.task.id === "habitacion_sabanas")?.assignedTo).toBeNull();
    expect(isTodayTask(states.find((row) => row.task.id === "cocina_comida")!)).toBe(true);
    expect(isTodayTask(states.find((row) => row.task.id === "gatos_bebedero")!)).toBe(false);
    expect(isOnDemandTask(states.find((row) => row.task.id === "cocina_suelo")!)).toBe(true);
  });

  test("converts edited household dates using Madrid daylight-saving time", () => {
    expect(madridDateTimeToIso("2026-08-22", "14:35")).toBe("2026-08-22T12:35:00.000Z");
    expect(madridDateTimeToIso("2026-01-15", "14:35")).toBe("2026-01-15T13:35:00.000Z");
    expect(madridTimeKey(new Date("2026-08-22T12:35:00.000Z"))).toBe("14:35");
  });

  test("keeps on-demand work out of the overdue state", () => {
    const state = buildTaskStates(TASKS, []).find((row) => row.task.id === "cocina_lavavajillas");
    expect(state?.status).toBe("on_demand");
    expect(state?.assignedTo).toBeNull();
    const floor = buildTaskStates(TASKS, []).find((row) => row.task.id === "cocina_suelo");
    expect(floor?.status).toBe("on_demand");
    expect(floor?.assignedTo).toBe("lucy");
    expect(floor?.dueLabel).toBe("Mínimo una vez esta semana");
  });

  test("includes the new quick household tasks as on-demand work", () => {
    const taskIds = [
      "cocina_desayuno",
      "cocina_poner_lavavajillas",
      "cocina_lavavajillas",
      "gatos_llenar_agua",
      "gatos_llenar_comida",
      "ropa_lavadora_trapos",
      "general_plumero",
      "general_robot_deposito",
      "general_robot_limpieza_profunda",
    ];
    const states = buildTaskStates(TASKS, []).filter((row) => taskIds.includes(row.task.id));

    expect(states).toHaveLength(taskIds.length);
    expect(states.every(isOnDemandTask)).toBe(true);
    expect(states.every((row) => row.status === "on_demand")).toBe(true);
    expect(states.every((row) => row.assignedTo === null)).toBe(true);
  });

  test("keeps breakfast on demand and marks it done after its daily point", () => {
    setSystemTime(new Date("2026-08-15T08:00:00+02:00"));
    const state = buildTaskStates(TASKS, []).find((row) => row.task.id === "cocina_desayuno");
    const first: Completion = {
      id: "breakfast-first",
      taskId: "cocina_desayuno",
      personId: "manu",
      completedAt: "2026-08-15T08:00:00+02:00",
    };
    const repeated: Completion = {
      ...first,
      id: "breakfast-repeated",
      personId: "manu",
      completedAt: "2026-08-15T09:00:00+02:00",
    };

    expect(state?.task.zoneId).toBe("cocina");
    expect(state?.task.points).toBe(1);
    expect(state?.task.maxScoredCompletionsPerPeriod).toBe(1);
    expect(state?.task.schedule.type).toBe("on_demand");
    expect(state?.assignedTo).toBeNull();
    expect(isOnDemandTask(state!)).toBe(true);
    expect(
      buildTaskStates(TASKS, [first]).find((row) => row.task.id === "cocina_desayuno"),
    ).toMatchObject({ status: "fresh", dueLabel: "Hecha hoy" });
    expect(scoreReceiptForCompletion(first, [first, repeated], TASKS).scored).toBe(true);
    expect(scoreReceiptForCompletion(repeated, [first, repeated], TASKS).reason).toBe("repeated");
  });

  test("keeps both dishwasher shortcuts available until their third daily completion", () => {
    setSystemTime(new Date("2026-08-15T18:00:00+02:00"));
    const taskIds = ["cocina_poner_lavavajillas", "cocina_lavavajillas"];
    const completions: Completion[] = taskIds.flatMap((taskId) =>
      [9, 13, 17].map((hour, index) => ({
        id: `${taskId}-${index + 1}`,
        taskId,
        personId: index % 2 === 0 ? "lucy" : "manu",
        completedAt: `2026-08-15T${String(hour).padStart(2, "0")}:00:00+02:00`,
      })),
    );

    for (const taskId of taskIds) {
      const firstTwo = completions.filter(
        (completion) => completion.taskId !== taskId || !completion.id.endsWith("-3"),
      );
      expect(buildTaskStates(TASKS, firstTwo).find((row) => row.task.id === taskId)).toMatchObject({
        status: "on_demand",
        completionCount: 2,
        completionLimit: 3,
        dueLabel: "2/3 hechas hoy",
      });
      expect(
        buildTaskStates(TASKS, completions).find((row) => row.task.id === taskId),
      ).toMatchObject({
        status: "fresh",
        completionCount: 3,
        completionLimit: 3,
        dueLabel: "3/3 hechas hoy",
      });
    }
  });

  test("adds making the bed as a one-point on-demand task for either person", () => {
    const state = buildTaskStates(TASKS, []).find((row) => row.task.id === "habitacion_hacer_cama");
    const first: Completion = {
      id: "bed-first",
      taskId: "habitacion_hacer_cama",
      personId: "lucy",
      completedAt: "2026-08-10T09:00:00+02:00",
    };
    const repeated: Completion = {
      ...first,
      id: "bed-repeated",
      personId: "manu",
      completedAt: "2026-08-10T10:00:00+02:00",
    };

    expect(state?.task.zoneId).toBe("habitacion");
    expect(state?.task.points).toBe(1);
    expect(state?.status).toBe("on_demand");
    expect(state?.assignedTo).toBeNull();
    expect(scoreReceiptForCompletion(first, [first, repeated], TASKS).scored).toBe(true);
    expect(scoreReceiptForCompletion(repeated, [first, repeated], TASKS).reason).toBe("repeated");
  });

  test("keeps changing sheets always available and scores every completion", () => {
    setSystemTime(new Date("2026-08-16T12:00:00+02:00"));
    const first: Completion = {
      id: "sheets-first",
      taskId: "habitacion_sabanas",
      personId: "lucy",
      completedAt: "2026-08-16T12:00:00+02:00",
    };
    const repeated: Completion = {
      ...first,
      id: "sheets-second",
      personId: "manu",
      completedAt: "2026-08-16T14:00:00+02:00",
    };
    const state = buildTaskStates(TASKS, [first, repeated]).find(
      (row) => row.task.id === "habitacion_sabanas",
    )!;

    expect(isOnDemandTask(state)).toBe(true);
    expect(state.assignedTo).toBeNull();
    expect(state.task.unlimitedScoring).toBe(true);
    expect(state).toMatchObject({
      status: "on_demand",
      dueLabel: "A demanda · cada vez suma 1 punto",
    });
    expect(scoreReceiptForCompletion(first, [first, repeated], TASKS).scored).toBe(true);
    expect(scoreReceiptForCompletion(repeated, [first, repeated], TASKS).scored).toBe(true);
    expect(leagueScores([first, repeated], TASKS, new Date("2026-08-10T00:00:00+02:00"))).toEqual({
      lucy: 1,
      manu: 1,
    });
  });

  test("respects lunch and evening instead of making everything urgent", () => {
    setSystemTime(new Date("2026-08-08T09:00:00+02:00"));
    const states = buildTaskStates(TASKS, []);
    expect(states.find((row) => row.task.id === "cocina_comida")?.status).toBe("later");
    expect(states.find((row) => row.task.id === "cocina_cena")?.dueLabel).toBe("Esta noche");
    expect(states.find((row) => row.task.id === "gatos_arenero")?.status).toBe("later");
  });

  test("alternates meals every day", () => {
    setSystemTime(new Date("2026-08-09T19:00:00+02:00"));
    const states = buildTaskStates(TASKS, []);
    expect(states.find((row) => row.task.id === "cocina_comida")?.assignedTo).toBe("lucy");
    expect(states.find((row) => row.task.id === "cocina_cena")?.assignedTo).toBe("manu");
  });

  test("alternates grouped weekly work together", () => {
    setSystemTime(new Date("2026-08-10T19:00:00+02:00"));
    const states = buildTaskStates(TASKS, []);
    expect(states.find((row) => row.task.id === "gatos_bebedero")?.assignedTo).toBe("manu");
    expect(states.find((row) => row.task.id === "habitacion_toallas_almohadas")?.assignedTo).toBe(
      "lucy",
    );
    expect(states.some((row) => row.task.id === "habitacion_toallas")).toBe(false);
    expect(states.some((row) => row.task.id === "habitacion_almohadas")).toBe(false);
  });

  test("brings the combined towel and pillowcase task into Today every Sunday", () => {
    setSystemTime(new Date("2026-08-16T12:00:00+02:00"));
    const sundayStates = buildTaskStates(TASKS, []);
    const sundayTextiles = sundayStates.find(
      (row) => row.task.id === "habitacion_toallas_almohadas",
    )!;
    expect(sundayTextiles.assignedTo).toBe("lucy");
    expect(sundayTextiles.task.points).toBe(1);
    expect(sundayTextiles.dueLabel).toBe("Toca hoy");
    expect(isTodayTask(sundayTextiles)).toBe(true);

    setSystemTime(new Date("2026-08-15T12:00:00+02:00"));
    const saturdayTowels = buildTaskStates(TASKS, []).find(
      (row) => row.task.id === "habitacion_toallas_almohadas",
    )!;
    expect(saturdayTowels.dueLabel).toBe("Este domingo");
    expect(isTodayTask(saturdayTowels)).toBe(false);
  });

  test("keeps a missed Sunday textile change in Monday's extra time", () => {
    setSystemTime(new Date("2026-08-17T00:11:00+02:00"));
    const missed = buildGraceTaskStates(TASKS, []).find(
      (row) => row.task.id === "habitacion_toallas_almohadas",
    )!;
    expect(missed.occurrenceDate).toBe("2026-08-16");
    expect(missed.assignedTo).toBe("lucy");

    const doneOnSunday: Completion = {
      id: "textiles-sunday",
      taskId: "habitacion_toallas_almohadas",
      personId: "lucy",
      completedAt: "2026-08-16T12:00:00+02:00",
    };
    expect(
      buildGraceTaskStates(TASKS, [doneOnSunday]).some(
        (row) => row.task.id === "habitacion_toallas_almohadas",
      ),
    ).toBe(false);
    setSystemTime(new Date("2026-08-08T19:00:00+02:00"));
  });

  test("builds the shared goal from the actual recurring workload", () => {
    expect(weeklyGoal(TASKS, new Date("2026-08-07T12:00:00+02:00"))).toBe(25);
    expect(weeklyGoal(TASKS, new Date("2026-08-15T12:00:00+02:00"))).toBe(25);
    expect(weeklyGoal(TASKS, new Date("2026-09-01T12:00:00+02:00"))).toBe(25);
  });

  test("only counts complete household weeks in the shared streak", () => {
    const dailyTaskIds = ["cocina_comida", "cocina_cena", "gatos_arenero"];
    const weeklyTaskIds = [
      "cocina_suelo",
      "gatos_bebedero",
      "gatos_rascador",
      "habitacion_toallas_almohadas",
    ];
    const completions: Completion[] = [
      ...Array.from({ length: 7 }, (_, day) =>
        dailyTaskIds.map((taskId, taskIndex) => ({
          id: `${taskId}-${day}`,
          taskId,
          personId: (day + taskIndex) % 2 === 0 ? ("lucy" as const) : ("manu" as const),
          completedAt: `2026-08-${String(10 + day).padStart(2, "0")}T12:00:00+02:00`,
        })),
      ).flat(),
      ...weeklyTaskIds.map((taskId, index) => ({
        id: `${taskId}-week`,
        taskId,
        personId: index % 2 === 0 ? ("lucy" as const) : ("manu" as const),
        completedAt: "2026-08-10T12:00:00+02:00",
      })),
    ];
    expect(householdWeekStreak(completions, TASKS, new Date("2026-08-17T12:00:00+02:00"))).toBe(1);
  });

  test("does not let repeats or free-form chores fill the shared goal", () => {
    const completions: Completion[] = Array.from({ length: 30 }, (_, index) => ({
      id: `quick-${index}`,
      taskId: index % 2 === 0 ? "gatos_llenar_agua" : "cocina_lavavajillas",
      personId: index % 2 === 0 ? "lucy" : "manu",
      completedAt: "2026-08-10T12:00:00+02:00",
    }));
    expect(
      householdWeekProgress(completions, TASKS, new Date("2026-08-10T12:00:00+02:00")),
    ).toEqual({
      done: 0,
      goal: 25,
    });
  });

  test("prevents repeated task completions from farming league points", () => {
    const completions: Completion[] = [
      {
        id: "second-same-day",
        taskId: "cocina_comida",
        personId: "manu",
        completedAt: "2026-08-07T11:00:00.000Z",
      },
      {
        id: "first-same-day",
        taskId: "cocina_comida",
        personId: "lucy",
        completedAt: "2026-08-07T09:00:00.000Z",
      },
      {
        id: "different-task",
        taskId: "cocina_cena",
        personId: "lucy",
        completedAt: "2026-08-07T12:00:00.000Z",
      },
      {
        id: "next-day",
        taskId: "cocina_comida",
        personId: "manu",
        completedAt: "2026-08-08T09:00:00.000Z",
      },
    ];
    expect(leagueScores(completions, TASKS, new Date("2026-08-03T00:00:00+02:00"))).toEqual({
      lucy: 2,
      manu: 1,
    });
  });

  test("returns an exact score receipt for scored, repeated, and on-demand chores", () => {
    const first: Completion = {
      id: "first-lunch",
      taskId: "cocina_comida",
      personId: "lucy",
      completedAt: "2026-08-10T12:00:00+02:00",
    };
    const repeated: Completion = {
      ...first,
      id: "repeated-lunch",
      personId: "manu",
      completedAt: "2026-08-10T13:00:00+02:00",
    };
    const quick: Completion = {
      id: "water",
      taskId: "gatos_llenar_agua",
      personId: "manu",
      completedAt: "2026-08-10T13:30:00+02:00",
    };

    expect(scoreReceiptForCompletion(first, [repeated, first], TASKS)).toMatchObject({
      scored: true,
      actorDelta: 1,
    });
    expect(scoreReceiptForCompletion(repeated, [repeated, first], TASKS).reason).toBe("repeated");
    expect(scoreReceiptForCompletion(quick, [quick], TASKS)).toMatchObject({
      scored: true,
      actorDelta: 1,
    });
  });

  test("keeps old kitchen-surface history but removes it from tasks and scoring", () => {
    const completions: Completion[] = [
      {
        id: "surfaces-lunch",
        taskId: "cocina_superficies",
        personId: "lucy",
        completedAt: "2026-08-10T15:00:00+02:00",
      },
      {
        id: "surfaces-dinner",
        taskId: "cocina_superficies",
        personId: "manu",
        completedAt: "2026-08-10T22:00:00+02:00",
      },
    ];

    expect(
      buildTaskStates(TASKS, completions).some((state) => state.task.id === "cocina_superficies"),
    ).toBe(false);
    expect(scoreReceiptForCompletion(completions[0]!, completions, TASKS).reason).toBe(
      "non_competitive",
    );
    expect(leagueScores(completions, TASKS, new Date("2026-08-10T00:00:00+02:00"))).toEqual({
      lucy: 0,
      manu: 0,
    });
  });

  test("uses a thirty-point duel and the Madrid Monday as reward week", () => {
    expect(WEEKLY_DUEL_TARGET).toBe(30);
    expect(mondayKey(localDateKey(new Date("2026-08-11T20:00:00+02:00")))).toBe("2026-08-10");
  });

  test("lets unloading the dishwasher score three times per day but not a fourth", () => {
    const completions: Completion[] = [
      {
        id: "dishwasher-first",
        taskId: "cocina_lavavajillas",
        personId: "manu",
        completedAt: "2026-08-10T09:00:00+02:00",
      },
      {
        id: "dishwasher-second",
        taskId: "cocina_lavavajillas",
        personId: "manu",
        completedAt: "2026-08-10T15:00:00+02:00",
      },
      {
        id: "dishwasher-third",
        taskId: "cocina_lavavajillas",
        personId: "lucy",
        completedAt: "2026-08-10T21:00:00+02:00",
      },
      {
        id: "dishwasher-fourth",
        taskId: "cocina_lavavajillas",
        personId: "lucy",
        completedAt: "2026-08-10T23:00:00+02:00",
      },
      {
        id: "dishwasher-next-day",
        taskId: "cocina_lavavajillas",
        personId: "lucy",
        completedAt: "2026-08-11T09:00:00+02:00",
      },
    ];

    expect(scoreReceiptForCompletion(completions[0]!, completions, TASKS).scored).toBe(true);
    expect(scoreReceiptForCompletion(completions[1]!, completions, TASKS).scored).toBe(true);
    expect(scoreReceiptForCompletion(completions[2]!, completions, TASKS).scored).toBe(true);
    expect(scoreReceiptForCompletion(completions[3]!, completions, TASKS).reason).toBe("repeated");
    expect(scoreReceiptForCompletion(completions[4]!, completions, TASKS).scored).toBe(true);
    expect(leagueScores(completions, TASKS, new Date("2026-08-10T00:00:00+02:00"))).toEqual({
      lucy: 2,
      manu: 2,
    });
  });

  test("locks the first person who reaches the weekly target as winner", () => {
    const completions: Completion[] = Array.from({ length: 11 }, (_, index) => ({
      id: `winner-${index}`,
      taskId: index % 2 === 0 ? "cocina_comida" : "cocina_cena",
      personId: "lucy" as const,
      completedAt: `2026-08-${String(3 + index).padStart(2, "0")}T12:00:00+02:00`,
    }));
    const winner = weeklyWinner(completions, TASKS, new Date("2026-08-03T00:00:00+02:00"), 3);
    expect(winner?.personId).toBe("lucy");
    expect(winner?.wonAt).toBe("2026-08-05T12:00:00+02:00");
  });

  test("awards a rescue point and deducts one from the original assignee", () => {
    const completions: Completion[] = [
      {
        id: "rescued-lunch",
        taskId: "cocina_comida",
        personId: "lucy",
        assignedPersonId: "manu",
        completedAt: "2026-08-08T12:00:00+02:00",
      },
      {
        id: "normal-dinner",
        taskId: "cocina_cena",
        personId: "lucy",
        assignedPersonId: "lucy",
        completedAt: "2026-08-08T20:00:00+02:00",
      },
      {
        id: "repeated-lunch",
        taskId: "cocina_comida",
        personId: "manu",
        assignedPersonId: "manu",
        completedAt: "2026-08-08T13:00:00+02:00",
      },
    ];
    const since = new Date("2026-08-03T00:00:00+02:00");

    expect(leagueScores(completions, TASKS, since)).toEqual({ lucy: 2, manu: -1 });
    expect(rescueStats(completions, TASKS, since)).toEqual({
      lucy: { rescued: 1, conceded: 0 },
      manu: { rescued: 0, conceded: 1 },
    });
    expect(isRescueCompletion(completions[0]!)).toBe(true);
    expect(isRescueCompletion(completions[1]!)).toBe(false);
  });

  test("requires explicit confirmation before a rescue can subtract a point", () => {
    const lunch = buildTaskStates(TASKS, []).find((state) => state.task.id === "cocina_comida")!;
    const activeWaiver = {
      id: "waiver",
      rewardId: "skip-next-task",
      title: "Vale por librarse de una tarea",
      emoji: "🛋️",
      earnedBy: "manu" as const,
      weekKey: "2026-08-03",
      earnedAt: "2026-08-03T10:00:00+02:00",
      redeemedAt: "2026-08-08T10:00:00+02:00",
    };

    expect(requiresRescueConfirmation(lunch, "lucy", [])).toBe(true);
    expect(requiresRescueConfirmation(lunch, "manu", [])).toBe(false);
    expect(requiresRescueConfirmation(lunch, "lucy", [activeWaiver])).toBe(false);
    expect(
      requiresRescueConfirmation(lunch, "lucy", [
        { ...activeWaiver, consumedAt: "2026-08-08T11:00:00+02:00" },
      ]),
    ).toBe(true);
  });

  test("undoing a rescue reverses both sides of the score", () => {
    const completion: Completion = {
      id: "undone-rescue",
      taskId: "gatos_arenero",
      personId: "lucy",
      assignedPersonId: "manu",
      completedAt: "2026-08-08T21:00:00+02:00",
      undoneAt: "2026-08-08T21:01:00+02:00",
    };

    expect(leagueScores([completion], TASKS, new Date("2026-08-03T00:00:00+02:00"))).toEqual({
      lucy: 0,
      manu: 0,
    });
  });

  test("assigns collecting and folding to the other person after washing and hanging", () => {
    const wash: Completion = {
      id: "white-wash",
      taskId: "ropa_lavadora_blanco",
      personId: "manu",
      completedAt: "2026-08-08T10:00:00+02:00",
    };
    const collectTask = TASKS.find((task) => task.id === "ropa_recoger_blanco")!;
    const waiting = buildTaskStates(TASKS, []).find(
      (state) => state.task.id === "ropa_recoger_blanco",
    )!;
    const assigned = buildTaskStates(TASKS, [wash]).find(
      (state) => state.task.id === "ropa_recoger_blanco",
    )!;

    expect(waiting.assignedTo).toBeNull();
    expect(waiting.dueLabel).toBe("Primero hay que lavar y tender");
    expect(isTodayTask(waiting)).toBe(false);
    expect(assigned.assignedTo).toBe("lucy");
    expect(assigned.dueLabel).toBe("Lista para recoger y doblar");
    expect(isTodayTask(assigned)).toBe(true);
    expect(assignedPersonForTask(collectTask, TASKS, new Date(), [wash])).toBe("lucy");

    const ragWash: Completion = {
      id: "rag-wash",
      taskId: "ropa_lavadora_trapos",
      personId: "lucy",
      completedAt: "2026-08-08T11:00:00+02:00",
    };
    const ragCollect = buildTaskStates(TASKS, [ragWash]).find(
      (state) => state.task.id === "ropa_recoger_trapos",
    )!;
    expect(ragCollect.assignedTo).toBe("manu");
    expect(ragCollect.dueLabel).toBe("Lista para recoger y guardar");
  });

  test("only activates a kitchen handoff after cooking is marked and assigns it to the other person", () => {
    setSystemTime(new Date("2026-08-10T13:00:00+02:00"));
    const beforeCooking = buildTaskStates(TASKS, []).find(
      (state) => state.task.id === "cocina_recoger_comida",
    )!;
    expect(beforeCooking.assignedTo).toBeNull();
    expect(beforeCooking.dueLabel).toBe("Primero hay que cocinar");
    expect(isTodayTask(beforeCooking)).toBe(false);

    const lunch: Completion = {
      id: "lunch",
      taskId: "cocina_comida",
      personId: "manu",
      completedAt: "2026-08-10T14:00:00+02:00",
    };
    setSystemTime(new Date("2026-08-10T16:00:00+02:00"));
    const active = buildTaskStates(TASKS, [lunch]).find(
      (state) => state.task.id === "cocina_recoger_comida",
    )!;
    expect(active.assignedTo).toBe("lucy");
    expect(active.dueLabel).toBe("Lista para recoger");
    expect(isTodayTask(active)).toBe(true);
    setSystemTime(new Date("2026-08-08T19:00:00+02:00"));
  });

  test("skips a meal without points or activating the kitchen handoff", () => {
    setSystemTime(new Date("2026-08-12T14:00:00+02:00"));
    const skippedLunch: Completion = {
      id: "skipped-lunch",
      taskId: "cocina_comida",
      personId: "manu",
      assignedPersonId: "manu",
      completedAt: "2026-08-12T13:30:00+02:00",
      skipped: true,
    };
    const states = buildTaskStates(TASKS, [skippedLunch]);
    const lunch = states.find((state) => state.task.id === "cocina_comida")!;
    const cleanup = states.find((state) => state.task.id === "cocina_recoger_comida")!;

    expect(lunch.status).toBe("fresh");
    expect(lunch.dueLabel).toBe("Hoy no se come en casa");
    expect(cleanup.assignedTo).toBeNull();
    expect(cleanup.dueLabel).toBe("Primero hay que cocinar");
    expect(scoreReceiptForCompletion(skippedLunch, [skippedLunch], TASKS).reason).toBe(
      "non_competitive",
    );
    expect(leagueScores([skippedLunch], TASKS, new Date("2026-08-10T00:00:00+02:00"))).toEqual({
      lucy: 0,
      manu: 0,
    });
    expect(householdWeekProgress([skippedLunch], TASKS).done).toBe(1);
    setSystemTime(new Date("2026-08-08T19:00:00+02:00"));
  });

  test("keeps yesterday's missed daily turn available without replacing today's turn", () => {
    setSystemTime(new Date("2026-08-13T00:11:00+02:00"));
    const grace = buildGraceTaskStates(TASKS, []);
    const yesterdayLitter = grace.find((state) => state.task.id === "gatos_arenero")!;
    const todayLitter = buildTaskStates(TASKS, []).find(
      (state) => state.task.id === "gatos_arenero",
    )!;

    expect(yesterdayLitter.occurrenceDate).toBe("2026-08-12");
    expect(yesterdayLitter.assignedTo).toBe("manu");
    expect(yesterdayLitter.dueLabel).toContain("Pendiente de ayer");
    expect(todayLitter.assignedTo).toBe("lucy");

    const doneYesterday: Completion = {
      id: "litter-yesterday",
      taskId: "gatos_arenero",
      personId: "manu",
      assignedPersonId: "manu",
      completedAt: "2026-08-12T23:30:00+02:00",
    };
    expect(
      buildGraceTaskStates(TASKS, [doneYesterday]).some(
        (state) => state.task.id === "gatos_arenero",
      ),
    ).toBe(false);
    setSystemTime(new Date("2026-08-08T19:00:00+02:00"));
  });

  test("keeps a linked laundry pickup visible on the next day while it remains pending", () => {
    const wash: Completion = {
      id: "late-drying-wash",
      taskId: "ropa_lavadora_blanco",
      personId: "lucy",
      completedAt: "2026-08-12T20:00:00+02:00",
    };
    setSystemTime(new Date("2026-08-13T12:00:00+02:00"));
    const pickup = buildTaskStates(TASKS, [wash]).find(
      (state) => state.task.id === "ropa_recoger_blanco",
    )!;
    expect(pickup.assignedTo).toBe("manu");
    expect(pickup.dueLabel).toBe("Lista para recoger y doblar");
    expect(isTodayTask(pickup)).toBe(true);
    setSystemTime(new Date("2026-08-08T19:00:00+02:00"));
  });

  test("turns collecting your own wash into a rescue for every laundry cycle", () => {
    const completions: Completion[] = [
      {
        id: "color-wash",
        taskId: "ropa_lavadora_color",
        personId: "manu",
        completedAt: "2026-08-08T09:00:00+02:00",
      },
      {
        id: "color-rescue",
        taskId: "ropa_recoger_color",
        personId: "manu",
        assignedPersonId: "lucy",
        completedAt: "2026-08-08T12:00:00+02:00",
      },
    ];
    const collectState = buildTaskStates(TASKS, completions).find(
      (state) => state.task.id === "ropa_recoger_color",
    )!;

    expect(collectState.status).toBe("fresh");
    expect(collectState.dueLabel).toBe("Recogida y doblada");
    expect(isRescueState(collectState)).toBe(true);
    expect(leagueScores(completions, TASKS, new Date("2026-08-03T00:00:00+02:00"))).toEqual({
      lucy: -1,
      manu: 2,
    });
  });
});

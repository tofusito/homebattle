import { MongoClient, type Collection, type Db, type Document } from "mongodb";

import {
  assignedPersonForTask,
  localDateKey,
  mondayKey,
  type CleaningData,
  type Completion,
  type HouseholdSettings,
  type Person,
  type PersonId,
  type RewardVoucher,
  type Task,
  type Zone,
  WEEKLY_DUEL_TARGET,
  scoreReceiptForCompletion,
  type ScoreReceipt,
  startOfWeek,
  weeklyWinner,
} from "@/lib/cleaning";
import { DEFAULT_REWARD, randomReward, rewardById } from "@/lib/rewards";
import { INITIAL_COMPLETIONS, PEOPLE, TASKS, ZONES } from "@/server/seed";

interface Stored<T> extends Document {
  _id: string;
  value: T;
}

interface StoredCompletion extends Document {
  _id: string;
  taskId: string;
  personId: PersonId;
  assignedPersonId?: PersonId;
  completedAt: Date;
  recordedAt?: Date;
  editedAt?: Date;
  skipped?: boolean;
  undoneAt?: Date;
  reportedPeriod?: string;
  waivedByRewardId?: string;
  waivedOwnerId?: PersonId;
}

interface StoredReward extends Document {
  _id: string;
  rewardId: string;
  title: string;
  emoji: string;
  earnedBy: PersonId;
  weekKey: string;
  earnedAt: Date;
  redeemedAt?: Date;
  consumedAt?: Date;
  consumedCompletionId?: string;
}

export interface StoredPushSubscription extends Document {
  _id: string;
  personId: PersonId;
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
  createdAt: Date;
  lastLunchKey?: string;
  lastEveningKey?: string;
}

let clientPromise: Promise<MongoClient> | undefined;
let seededPromise: Promise<Db> | undefined;

const DEFAULT_SETTINGS: HouseholdSettings = {
  weeklyPrize: DEFAULT_REWARD.title,
  weeklyRewardId: DEFAULT_REWARD.id,
  weeklyRewardWeekKey: "",
  weeklyRefreshVotes: [],
  weeklyRefreshUsed: false,
};

function normalizedSettings(settings?: HouseholdSettings, date = new Date()): HouseholdSettings {
  const weekKey = mondayKey(localDateKey(date));
  if (
    !settings?.weeklyRewardId ||
    settings.weeklyPrize.toLowerCase().includes("película") ||
    settings.weeklyRewardWeekKey !== weekKey
  ) {
    const reward = randomReward();
    return {
      weeklyPrize: reward.title,
      weeklyRewardId: reward.id,
      weeklyRewardWeekKey: weekKey,
      weeklyRefreshVotes: [],
      weeklyRefreshUsed: false,
    };
  }
  return {
    ...settings,
    weeklyRefreshVotes: settings.weeklyRefreshVotes ?? [],
    weeklyRefreshUsed: settings.weeklyRefreshUsed ?? false,
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function mongoUri(): string {
  const user = encodeURIComponent(required("MONGODB_USERNAME"));
  const password = encodeURIComponent(required("MONGODB_PASSWORD"));
  const host = process.env["MONGODB_HOST"] ?? "127.0.0.1";
  const port = process.env["MONGODB_PORT"] ?? "27017";
  const authSource = encodeURIComponent(
    process.env["MONGODB_AUTH_SOURCE"] ?? required("MONGODB_DATABASE"),
  );
  return `mongodb://${user}:${password}@${host}:${port}/?authSource=${authSource}`;
}

async function database(): Promise<Db> {
  clientPromise ??= new MongoClient(mongoUri(), {
    maxPoolSize: 8,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
    appName: "happy-home",
  })
    .connect()
    .catch((error: unknown) => {
      // Una promesa rechazada cacheada dejaría la app rota para siempre;
      // se descarta para que el siguiente request vuelva a intentar conectar.
      clientPromise = undefined;
      throw error;
    });
  const client = await clientPromise;
  return client.db(required("MONGODB_DATABASE"));
}

function values<T>(db: Db, name: string): Collection<Stored<T>> {
  return db.collection<Stored<T>>(name);
}

async function upsertValues<T extends { id: string }>(
  collection: Collection<Stored<T>>,
  rows: T[],
) {
  await collection.bulkWrite(
    rows.map((row) => ({
      updateOne: { filter: { _id: row.id }, update: { $set: { value: row } }, upsert: true },
    })),
  );
}

async function readyDatabase(): Promise<Db> {
  seededPromise ??= (async () => {
    const db = await database();
    try {
      await seedDatabase(db);
    } catch (error) {
      seededPromise = undefined;
      throw error;
    }
    return db;
  })();
  return seededPromise;
}

async function seedDatabase(db: Db): Promise<void> {
  await Promise.all([
    upsertValues<Person>(values(db, "people"), PEOPLE),
    upsertValues<Zone>(values(db, "zones"), ZONES),
    upsertValues<Task>(values(db, "tasks"), TASKS),
    db.collection<StoredCompletion>("completions").createIndex({ completedAt: -1 }),
    db.collection<StoredCompletion>("completions").createIndex({ taskId: 1, completedAt: -1 }),
    db.collection<StoredReward>("rewards").createIndex({ earnedBy: 1, earnedAt: -1 }),
    db.collection<StoredPushSubscription>("pushSubscriptions").createIndex({ personId: 1 }),
    values<HouseholdSettings>(db, "settings").updateOne(
      { _id: "household" },
      { $setOnInsert: { value: DEFAULT_SETTINGS } },
      { upsert: true },
    ),
  ]);
  for (const completion of INITIAL_COMPLETIONS) {
    await db.collection<StoredCompletion>("completions").updateOne(
      { _id: completion.id },
      {
        $setOnInsert: {
          taskId: completion.taskId,
          personId: completion.personId,
          completedAt: new Date(completion.completedAt),
        },
        ...(completion.reportedPeriod
          ? { $set: { reportedPeriod: completion.reportedPeriod } }
          : {}),
      },
      { upsert: true },
    );
  }
}

export async function closeDatabase(): Promise<void> {
  const pending = clientPromise;
  clientPromise = undefined;
  seededPromise = undefined;
  if (!pending) return;
  try {
    const client = await pending;
    await client.close();
  } catch {
    // El cliente nunca llegó a conectar; no hay nada que cerrar.
  }
}

export async function pingDatabase(): Promise<void> {
  const db = await readyDatabase();
  await db.command({ ping: 1 });
}

// Ventana de histórico enviada al cliente. Cubre de sobra la liga semanal,
// las rotaciones y las rachas; evita que el payload crezca sin límite con los años.
export const HISTORY_WINDOW_DAYS = 120;

export function historyWindowStart(now = new Date()): Date {
  return new Date(now.getTime() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1_000);
}

// Caché en memoria del payload montado. Las mutaciones invalidan; el TTL corto
// cubre los cambios que no pasan por una mutación (rotación semanal, recordatorios).
const PAYLOAD_CACHE_TTL_MS = 60_000;
let payloadCache: { data: CleaningData; expiresAt: number } | undefined;
let payloadGeneration = 0;

export function invalidateCleaningCache(): void {
  payloadGeneration += 1;
  payloadCache = undefined;
}

export async function readCleaningData(): Promise<CleaningData> {
  if (payloadCache && payloadCache.expiresAt > Date.now()) return payloadCache.data;
  const generation = payloadGeneration;
  const db = await readyDatabase();
  const [people, zones, tasks, completions, settings, rewards] = await Promise.all([
    values<Person>(db, "people").find().toArray(),
    values<Zone>(db, "zones").find().toArray(),
    values<Task>(db, "tasks").find().toArray(),
    db
      .collection<StoredCompletion>("completions")
      .find({ completedAt: { $gte: historyWindowStart() } })
      .sort({ completedAt: -1 })
      .limit(5_000)
      .toArray(),
    values<HouseholdSettings>(db, "settings").findOne({ _id: "household" }),
    db.collection<StoredReward>("rewards").find().sort({ earnedAt: -1 }).limit(500).toArray(),
  ]);
  let currentSettings = normalizedSettings(settings?.value);
  if (!settings) {
    await values<HouseholdSettings>(db, "settings").updateOne(
      { _id: "household" },
      { $setOnInsert: { value: currentSettings } },
      { upsert: true },
    );
    const savedSettings = await values<HouseholdSettings>(db, "settings").findOne({
      _id: "household",
    });
    currentSettings = normalizedSettings(savedSettings?.value);
  } else if (settings.value.weeklyRewardWeekKey !== currentSettings.weeklyRewardWeekKey) {
    const result = await values<HouseholdSettings>(db, "settings").updateOne(
      {
        _id: "household",
        "value.weeklyRewardWeekKey": { $ne: currentSettings.weeklyRewardWeekKey },
      },
      { $set: { value: currentSettings } },
    );
    if (result.modifiedCount === 0) {
      const savedSettings = await values<HouseholdSettings>(db, "settings").findOne({
        _id: "household",
      });
      currentSettings = normalizedSettings(savedSettings?.value);
    }
  }
  const taskValues = tasks.map((row) => row.value).sort((a, b) => a.sortOrder - b.sortOrder);
  const newlyEarned = await ensureWeeklyReward(db, taskValues, new Date());
  const rewardValues = rewards.map(storedRewardToVoucher);
  if (newlyEarned && !rewardValues.some((reward) => reward.id === newlyEarned.id)) {
    rewardValues.unshift(newlyEarned);
  }
  const payload: CleaningData = {
    people: people.map((row) => row.value).sort((a, b) => a.label.localeCompare(b.label)),
    zones: zones.map((row) => row.value).sort((a, b) => a.sortOrder - b.sortOrder),
    tasks: taskValues,
    completions: completions.map((row) => ({
      id: row._id,
      taskId: row.taskId,
      personId: row.personId,
      ...(row.assignedPersonId ? { assignedPersonId: row.assignedPersonId } : {}),
      completedAt: row.completedAt.toISOString(),
      ...(row.recordedAt ? { recordedAt: row.recordedAt.toISOString() } : {}),
      ...(row.editedAt ? { editedAt: row.editedAt.toISOString() } : {}),
      ...(row.skipped ? { skipped: true } : {}),
      ...(row.undoneAt ? { undoneAt: row.undoneAt.toISOString() } : {}),
      ...(row.reportedPeriod ? { reportedPeriod: row.reportedPeriod } : {}),
      ...(row.waivedByRewardId ? { waivedByRewardId: row.waivedByRewardId } : {}),
      ...(row.waivedOwnerId ? { waivedOwnerId: row.waivedOwnerId } : {}),
    })),
    settings: currentSettings,
    rewards: rewardValues,
  };
  if (generation === payloadGeneration) {
    payloadCache = { data: payload, expiresAt: Date.now() + PAYLOAD_CACHE_TTL_MS };
  }
  return payload;
}

export async function addCompletion(input: {
  id: string;
  taskId: string;
  personId: PersonId;
  completedAt: string;
  skipped?: boolean;
}): Promise<{ receipt: ScoreReceipt; rewardEarned?: RewardVoucher }> {
  const db = await readyDatabase();
  const [task, person, taskRows] = await Promise.all([
    values<Task>(db, "tasks").findOne({ _id: input.taskId }),
    values<Person>(db, "people").findOne({ _id: input.personId }),
    values<Task>(db, "tasks").find().toArray(),
  ]);
  if (!task || !person) throw new Error("Unknown task or person");
  const completedAt = new Date(input.completedAt);
  const linkedSourceRows =
    task.value.schedule.type === "linked"
      ? await db
          .collection<StoredCompletion>("completions")
          .find({
            taskId: task.value.schedule.sourceTaskId,
            undoneAt: { $exists: false },
            skipped: { $ne: true },
            completedAt: { $lte: completedAt },
          })
          .sort({ completedAt: -1 })
          .limit(1)
          .toArray()
      : [];
  const linkedCompletions: Completion[] = linkedSourceRows.map((row) => ({
    id: row._id,
    taskId: row.taskId,
    personId: row.personId,
    completedAt: row.completedAt.toISOString(),
    ...(row.skipped ? { skipped: true } : {}),
  }));
  const assignedPersonId = assignedPersonForTask(
    task.value,
    taskRows.map((row) => row.value),
    completedAt,
    linkedCompletions,
  );
  if (input.skipped && task.value.id !== "cocina_comida" && task.value.id !== "cocina_cena") {
    throw new Error("Only lunch and dinner can be skipped");
  }
  if (input.skipped && assignedPersonId !== input.personId) {
    throw new Error("Only the assigned person can skip this meal");
  }
  const waiver =
    !input.skipped && assignedPersonId && assignedPersonId !== input.personId
      ? await db.collection<StoredReward>("rewards").findOne({
          rewardId: "skip-next-task",
          earnedBy: assignedPersonId,
          redeemedAt: { $exists: true },
          consumedAt: { $exists: false },
        })
      : null;
  const completionInsert = await db.collection<StoredCompletion>("completions").updateOne(
    { _id: input.id },
    {
      $setOnInsert: {
        taskId: input.taskId,
        personId: input.personId,
        ...(input.skipped ? { skipped: true } : {}),
        ...(assignedPersonId
          ? { assignedPersonId: waiver ? input.personId : assignedPersonId }
          : {}),
        ...(waiver ? { waivedByRewardId: waiver._id, waivedOwnerId: assignedPersonId! } : {}),
        completedAt,
        recordedAt: new Date(),
      },
    },
    { upsert: true },
  );
  if (waiver && completionInsert.upsertedCount === 1) {
    await db
      .collection<StoredReward>("rewards")
      .updateOne(
        { _id: waiver._id, consumedAt: { $exists: false } },
        { $set: { consumedAt: completedAt, consumedCompletionId: input.id } },
      );
  }
  const stored = await db
    .collection<StoredCompletion>("completions")
    .find({ taskId: input.taskId, undoneAt: { $exists: false } })
    .sort({ completedAt: 1 })
    .toArray();
  const completions: Completion[] = stored.map((row) => ({
    id: row._id,
    taskId: row.taskId,
    personId: row.personId,
    ...(row.assignedPersonId ? { assignedPersonId: row.assignedPersonId } : {}),
    completedAt: row.completedAt.toISOString(),
    ...(row.skipped ? { skipped: true } : {}),
    ...(row.waivedByRewardId ? { waivedByRewardId: row.waivedByRewardId } : {}),
    ...(row.waivedOwnerId ? { waivedOwnerId: row.waivedOwnerId } : {}),
  }));
  const inserted = completions.find((completion) => completion.id === input.id);
  if (!inserted) throw new Error("Completion could not be read after saving");
  const receipt = scoreReceiptForCompletion(
    inserted,
    completions,
    taskRows.map((row) => row.value),
  );
  const rewardEarned = await ensureWeeklyReward(
    db,
    taskRows.map((row) => row.value),
    completedAt,
  );
  return { receipt, ...(rewardEarned ? { rewardEarned } : {}) };
}

export async function editCompletion(input: {
  id: string;
  personId: PersonId;
  completedAt: string;
}): Promise<{ completion: Completion; receipt: ScoreReceipt }> {
  const db = await readyDatabase();
  const [stored, person, taskRows] = await Promise.all([
    db.collection<StoredCompletion>("completions").findOne({
      _id: input.id,
      undoneAt: { $exists: false },
    }),
    values<Person>(db, "people").findOne({ _id: input.personId }),
    values<Task>(db, "tasks").find().toArray(),
  ]);
  if (!stored) throw new Error("Completion not found");
  if (!person) throw new Error("Unknown person");
  if (stored.waivedByRewardId) {
    throw new Error("A completion that consumed a voucher cannot be edited");
  }
  const task = taskRows.find((row) => row._id === stored.taskId)?.value;
  if (!task) throw new Error("Unknown task");

  const completedAt = new Date(input.completedAt);
  if (!Number.isFinite(completedAt.getTime())) throw new Error("Invalid completion date");
  if (completedAt.getTime() > Date.now() + 60_000) {
    throw new Error("A completion cannot be moved into the future");
  }

  const linkedSourceRows =
    task.schedule.type === "linked"
      ? await db
          .collection<StoredCompletion>("completions")
          .find({
            taskId: task.schedule.sourceTaskId,
            undoneAt: { $exists: false },
            skipped: { $ne: true },
            completedAt: { $lte: completedAt },
          })
          .sort({ completedAt: -1 })
          .limit(1)
          .toArray()
      : [];
  if (task.schedule.type === "linked" && linkedSourceRows.length === 0) {
    throw new Error("The source task must happen before this linked completion");
  }
  const linkedCompletions: Completion[] = linkedSourceRows.map((row) => ({
    id: row._id,
    taskId: row.taskId,
    personId: row.personId,
    completedAt: row.completedAt.toISOString(),
  }));
  const tasks = taskRows.map((row) => row.value);
  const assignedPersonId = assignedPersonForTask(task, tasks, completedAt, linkedCompletions);
  if (stored.skipped && assignedPersonId !== input.personId) {
    throw new Error("Only the assigned person can own a skipped meal");
  }
  const waiver =
    !stored.skipped && assignedPersonId && assignedPersonId !== input.personId
      ? await db.collection<StoredReward>("rewards").findOne({
          rewardId: "skip-next-task",
          earnedBy: assignedPersonId,
          redeemedAt: { $exists: true },
          consumedAt: { $exists: false },
        })
      : null;

  const editedAt = new Date();
  const update = {
    $set: {
      personId: input.personId,
      completedAt,
      recordedAt: stored.recordedAt ?? stored.completedAt,
      editedAt,
      ...(assignedPersonId ? { assignedPersonId: waiver ? input.personId : assignedPersonId } : {}),
      ...(waiver ? { waivedByRewardId: waiver._id, waivedOwnerId: assignedPersonId! } : {}),
    },
    ...(!assignedPersonId ? { $unset: { assignedPersonId: "" } } : {}),
  };
  const result = await db
    .collection<StoredCompletion>("completions")
    .updateOne({ _id: input.id, undoneAt: { $exists: false } }, update);
  if (result.matchedCount === 0) throw new Error("Completion not found");
  if (waiver) {
    await db
      .collection<StoredReward>("rewards")
      .updateOne(
        { _id: waiver._id, consumedAt: { $exists: false } },
        { $set: { consumedAt: completedAt, consumedCompletionId: input.id } },
      );
  }

  const rows = await db
    .collection<StoredCompletion>("completions")
    .find({ taskId: stored.taskId, undoneAt: { $exists: false } })
    .sort({ completedAt: 1 })
    .toArray();
  const completions: Completion[] = rows.map((row) => ({
    id: row._id,
    taskId: row.taskId,
    personId: row.personId,
    ...(row.assignedPersonId ? { assignedPersonId: row.assignedPersonId } : {}),
    completedAt: row.completedAt.toISOString(),
    ...(row.recordedAt ? { recordedAt: row.recordedAt.toISOString() } : {}),
    ...(row.editedAt ? { editedAt: row.editedAt.toISOString() } : {}),
    ...(row.skipped ? { skipped: true } : {}),
    ...(row.waivedByRewardId ? { waivedByRewardId: row.waivedByRewardId } : {}),
    ...(row.waivedOwnerId ? { waivedOwnerId: row.waivedOwnerId } : {}),
  }));
  const completion = completions.find((row) => row.id === input.id);
  if (!completion) throw new Error("Completion could not be read after editing");

  await reconcileWeeklyReward(db, stored.completedAt);
  if (mondayKey(localDateKey(stored.completedAt)) !== mondayKey(localDateKey(completedAt))) {
    await reconcileWeeklyReward(db, completedAt);
  }
  if (mondayKey(localDateKey(completedAt)) === mondayKey(localDateKey())) {
    await ensureWeeklyReward(db, tasks, completedAt);
  }
  return { completion, receipt: scoreReceiptForCompletion(completion, completions, tasks) };
}

export async function redeemReward(id: string, personId: PersonId): Promise<RewardVoucher> {
  const db = await readyDatabase();
  const result = await db
    .collection<StoredReward>("rewards")
    .findOneAndUpdate(
      { _id: id, earnedBy: personId, redeemedAt: { $exists: false } },
      { $set: { redeemedAt: new Date() } },
      { returnDocument: "after" },
    );
  if (!result) throw new Error("Reward is not available for this person");
  return storedRewardToVoucher(result);
}

export async function toggleWeeklyPrizeRefresh(personId: PersonId): Promise<{
  settings: HouseholdSettings;
  refreshed: boolean;
  voted: boolean;
}> {
  const db = await readyDatabase();
  const weekKey = mondayKey(localDateKey());
  const settingsCollection = db.collection<Stored<HouseholdSettings>>("settings");
  let stored = await settingsCollection.findOne({ _id: "household" });
  let settings = normalizedSettings(stored?.value);

  if (stored?.value.weeklyRewardWeekKey !== weekKey) {
    await settingsCollection.updateOne(
      { _id: "household" },
      { $set: { value: settings } },
      { upsert: true },
    );
  }

  const wonReward = await db.collection<StoredReward>("rewards").findOne({
    _id: `weekly-${weekKey}`,
  });
  if (wonReward) throw new Error("The weekly reward has already been won");
  if (settings.weeklyRefreshUsed) throw new Error("The weekly refresh has already been used");

  const alreadyVoted = (settings.weeklyRefreshVotes ?? []).includes(personId);
  const updatedAt = new Date().toISOString();
  if (alreadyVoted) {
    await settingsCollection.updateOne(
      {
        _id: "household",
        "value.weeklyRefreshUsed": { $ne: true },
        "value.weeklyRefreshVotes": { $all: [personId], $size: 1 },
      },
      {
        $set: { "value.weeklyRefreshVotes": [], "value.updatedAt": updatedAt },
      },
    );
  } else {
    await settingsCollection.updateOne(
      { _id: "household", "value.weeklyRefreshUsed": { $ne: true } },
      {
        $addToSet: { "value.weeklyRefreshVotes": personId },
        $set: { "value.updatedAt": updatedAt },
      },
    );
  }

  stored = await settingsCollection.findOne({ _id: "household" });
  settings = normalizedSettings(stored?.value);
  const bothVoted = ["lucy", "manu"].every((id) =>
    (settings.weeklyRefreshVotes ?? []).includes(id as PersonId),
  );
  let refreshed = false;

  if (bothVoted) {
    const reward = randomReward();
    const result = await settingsCollection.updateOne(
      {
        _id: "household",
        "value.weeklyRefreshUsed": { $ne: true },
        "value.weeklyRefreshVotes": { $all: ["lucy", "manu"] },
      },
      {
        $set: {
          "value.weeklyPrize": reward.title,
          "value.weeklyRewardId": reward.id,
          "value.weeklyRefreshVotes": [],
          "value.weeklyRefreshUsed": true,
          "value.updatedAt": new Date().toISOString(),
        },
      },
    );
    refreshed = result.modifiedCount === 1;
    stored = await settingsCollection.findOne({ _id: "household" });
    settings = normalizedSettings(stored?.value);
  }

  return { settings, refreshed, voted: !alreadyVoted && !refreshed };
}

export async function savePushSubscription(input: {
  personId: PersonId;
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  const db = await readyDatabase();
  await db.collection<StoredPushSubscription>("pushSubscriptions").updateOne(
    { _id: input.endpoint },
    {
      $set: {
        personId: input.personId,
        endpoint: input.endpoint,
        expirationTime: input.expirationTime,
        keys: input.keys,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const db = await readyDatabase();
  await db.collection<StoredPushSubscription>("pushSubscriptions").deleteOne({ _id: endpoint });
}

export async function reminderDatabase(): Promise<Db> {
  return readyDatabase();
}

async function ensureWeeklyReward(
  db: Db,
  tasks: Task[],
  completedAt: Date,
): Promise<RewardVoucher | null> {
  const weekStart = startOfWeek(completedAt);
  // Si la semana ya tiene premio no puede ganarse otra vez: evita reescanear
  // las completions de la semana en cada lectura.
  const existingWeekly = await db
    .collection<StoredReward>("rewards")
    .findOne({ _id: `weekly-${mondayKey(localDateKey(completedAt))}` });
  if (existingWeekly) return null;
  const rows = await db
    .collection<StoredCompletion>("completions")
    .find({ completedAt: { $gte: weekStart }, undoneAt: { $exists: false } })
    .sort({ completedAt: 1 })
    .toArray();
  const winner = weeklyWinner(
    rows.map((row) => ({
      id: row._id,
      taskId: row.taskId,
      personId: row.personId,
      ...(row.assignedPersonId ? { assignedPersonId: row.assignedPersonId } : {}),
      completedAt: row.completedAt.toISOString(),
      ...(row.skipped ? { skipped: true } : {}),
    })),
    tasks,
    weekStart,
    WEEKLY_DUEL_TARGET,
  );
  if (!winner) return null;

  const storedSettings = await values<HouseholdSettings>(db, "settings").findOne({
    _id: "household",
  });
  const settings = normalizedSettings(storedSettings?.value, completedAt);
  const reward = rewardById(settings.weeklyRewardId);
  const weekKey = mondayKey(localDateKey(completedAt));
  const voucher: RewardVoucher = {
    id: `weekly-${weekKey}`,
    rewardId: reward.id,
    title: reward.title,
    emoji: reward.emoji,
    earnedBy: winner.personId,
    weekKey,
    earnedAt: winner.wonAt,
  };
  const result = await db.collection<StoredReward>("rewards").updateOne(
    { _id: voucher.id },
    {
      $setOnInsert: {
        rewardId: voucher.rewardId,
        title: voucher.title,
        emoji: voucher.emoji,
        earnedBy: voucher.earnedBy,
        weekKey: voucher.weekKey,
        earnedAt: new Date(voucher.earnedAt),
      },
    },
    { upsert: true },
  );
  return result.upsertedCount === 1 ? voucher : null;
}

function storedRewardToVoucher(row: StoredReward): RewardVoucher {
  return {
    id: row._id,
    rewardId: row.rewardId,
    title: row.title,
    emoji: row.emoji,
    earnedBy: row.earnedBy,
    weekKey: row.weekKey,
    earnedAt: row.earnedAt.toISOString(),
    ...(row.redeemedAt ? { redeemedAt: row.redeemedAt.toISOString() } : {}),
    ...(row.consumedAt ? { consumedAt: row.consumedAt.toISOString() } : {}),
    ...(row.consumedCompletionId ? { consumedCompletionId: row.consumedCompletionId } : {}),
  };
}

export async function undoCompletion(id: string): Promise<void> {
  const db = await readyDatabase();
  const completion = await db.collection<StoredCompletion>("completions").findOne({ _id: id });
  const result = await db
    .collection<StoredCompletion>("completions")
    .updateOne({ _id: id, undoneAt: { $exists: false } }, { $set: { undoneAt: new Date() } });
  if (result.matchedCount === 0) throw new Error("Completion not found");
  if (completion?.waivedByRewardId) {
    await db
      .collection<StoredReward>("rewards")
      .updateOne(
        { _id: completion.waivedByRewardId, consumedCompletionId: id },
        { $unset: { consumedAt: "", consumedCompletionId: "" } },
      );
  }
  if (completion) await reconcileWeeklyReward(db, completion.completedAt);
}

async function reconcileWeeklyReward(db: Db, date: Date): Promise<void> {
  const weekStart = startOfWeek(date);
  const weekKey = mondayKey(localDateKey(date));
  const rewardCollection = db.collection<StoredReward>("rewards");
  const existing = await rewardCollection.findOne({ _id: `weekly-${weekKey}` });
  if (!existing || existing.redeemedAt) return;
  const [taskRows, completionRows] = await Promise.all([
    values<Task>(db, "tasks").find().toArray(),
    db
      .collection<StoredCompletion>("completions")
      .find({ completedAt: { $gte: weekStart }, undoneAt: { $exists: false } })
      .sort({ completedAt: 1 })
      .toArray(),
  ]);
  const winner = weeklyWinner(
    completionRows.map((row) => ({
      id: row._id,
      taskId: row.taskId,
      personId: row.personId,
      ...(row.assignedPersonId ? { assignedPersonId: row.assignedPersonId } : {}),
      completedAt: row.completedAt.toISOString(),
      ...(row.skipped ? { skipped: true } : {}),
    })),
    taskRows.map((row) => row.value),
    weekStart,
    WEEKLY_DUEL_TARGET,
  );
  if (!winner) {
    await rewardCollection.deleteOne({ _id: existing._id, redeemedAt: { $exists: false } });
    return;
  }
  await rewardCollection.updateOne(
    { _id: existing._id, redeemedAt: { $exists: false } },
    { $set: { earnedBy: winner.personId, earnedAt: new Date(winner.wonAt) } },
  );
}

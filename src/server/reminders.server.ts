import webpush from "web-push";

import {
  buildTaskStates,
  localDateKey,
  type Completion,
  type PersonId,
  type Task,
} from "@/lib/cleaning";
import { reminderDatabase, type StoredPushSubscription } from "@/server/database.server";

let started = false;

export function startReminderScheduler(): void {
  if (started || !configured()) return;
  started = true;
  webpush.setVapidDetails(
    process.env["VAPID_SUBJECT"] ?? "mailto:happy-home@localhost",
    process.env["VAPID_PUBLIC_KEY"]!,
    process.env["VAPID_PRIVATE_KEY"]!,
  );
  void sendDueReminders();
  setInterval(() => void sendDueReminders(), 5 * 60_000).unref();
}

function configured(): boolean {
  return Boolean(process.env["VAPID_PUBLIC_KEY"] && process.env["VAPID_PRIVATE_KEY"]);
}

async function sendDueReminders(): Promise<void> {
  const period = currentPeriod();
  if (!period) return;
  const db = await reminderDatabase();
  const [taskRows, completionRows, subscriptions] = await Promise.all([
    db.collection<{ _id: string; value: Task }>("tasks").find().toArray(),
    db
      .collection<{
        _id: string;
        taskId: string;
        personId: PersonId;
        assignedPersonId?: PersonId;
        completedAt: Date;
        skipped?: boolean;
        undoneAt?: Date;
      }>("completions")
      .find({ undoneAt: { $exists: false } })
      .sort({ completedAt: -1 })
      .limit(1_000)
      .toArray(),
    db.collection<StoredPushSubscription>("pushSubscriptions").find().toArray(),
  ]);
  const tasks = taskRows.map((row) => row.value);
  const completions: Completion[] = completionRows.map((row) => ({
    id: row._id,
    taskId: row.taskId,
    personId: row.personId,
    ...(row.assignedPersonId ? { assignedPersonId: row.assignedPersonId } : {}),
    completedAt: row.completedAt.toISOString(),
    ...(row.skipped ? { skipped: true } : {}),
    ...(row.undoneAt ? { undoneAt: row.undoneAt.toISOString() } : {}),
  }));
  const states = buildTaskStates(tasks, completions);
  const dateKey = localDateKey();

  for (const subscription of subscriptions) {
    const sentKey = period === "lunch" ? subscription.lastLunchKey : subscription.lastEveningKey;
    if (sentKey === dateKey) continue;
    const pending = states.filter(
      (state) =>
        state.assignedTo === subscription.personId &&
        state.status !== "fresh" &&
        "preferredPeriod" in state.task.schedule &&
        state.task.schedule.preferredPeriod === period,
    );
    if (pending.length === 0) continue;
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: subscription.keys,
        },
        JSON.stringify({
          title: "Happy Home",
          body:
            pending.length === 1
              ? `${pending[0]!.task.name} te espera con cariño.`
              : `Tienes ${pending.length} tareas de tu turno esperando con cariño.`,
          url: "/",
          tag: `happy-home-${period}-${dateKey}`,
        }),
      );
      await db
        .collection<StoredPushSubscription>("pushSubscriptions")
        .updateOne(
          { _id: subscription._id },
          { $set: { [period === "lunch" ? "lastLunchKey" : "lastEveningKey"]: dateKey } },
        );
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        await db.collection<StoredPushSubscription>("pushSubscriptions").deleteOne({
          _id: subscription._id,
        });
      } else {
        console.error(error);
      }
    }
  }
}

function currentPeriod(): "lunch" | "evening" | null {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (hour >= 13 && hour < 16) return "lunch";
  if (hour >= 21 && hour < 23) return "evening";
  return null;
}

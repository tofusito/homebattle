import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  addCompletion,
  invalidateCleaningCache,
  editCompletion,
  readCleaningData,
  redeemReward,
  removePushSubscription,
  savePushSubscription,
  toggleWeeklyPrizeRefresh,
  undoCompletion,
} from "@/server/database.server";
import { publishCleaningChange } from "@/server/events.server";

export const getCleaningData = createServerFn({ method: "GET" }).handler(() => readCleaningData());

export const markTaskDone = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      taskId: z.string().min(1).max(80),
      personId: z.enum(["lucy", "manu"]),
      completedAt: z.string().datetime({ offset: true }).optional(),
      skipped: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const result = await addCompletion({
      id: data.id,
      taskId: data.taskId,
      personId: data.personId,
      completedAt: data.completedAt ?? new Date().toISOString(),
      ...(data.skipped ? { skipped: true } : {}),
    });
    invalidateCleaningCache();
    publishCleaningChange();
    return { ok: true, ...result };
  });

export const editTaskCompletion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1).max(100),
      personId: z.enum(["lucy", "manu"]),
      completedAt: z.string().datetime({ offset: true }),
    }),
  )
  .handler(async ({ data }) => {
    const result = await editCompletion(data);
    invalidateCleaningCache();
    publishCleaningChange();
    return { ok: true, ...result };
  });

export const redeemRewardVoucher = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(3).max(100), personId: z.enum(["lucy", "manu"]) }))
  .handler(async ({ data }) => {
    const reward = await redeemReward(data.id, data.personId);
    invalidateCleaningCache();
    publishCleaningChange();
    return { ok: true, reward };
  });

export const voteWeeklyPrizeRefresh = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.enum(["lucy", "manu"]) }))
  .handler(async ({ data }) => {
    const result = await toggleWeeklyPrizeRefresh(data.personId);
    invalidateCleaningCache();
    publishCleaningChange();
    return { ok: true, ...result };
  });

export const getPushConfig = createServerFn({ method: "GET" }).handler(() => ({
  enabled: Boolean(process.env["VAPID_PUBLIC_KEY"] && process.env["VAPID_PRIVATE_KEY"]),
  publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
}));

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2_000),
  expirationTime: z.number().nullable(),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(5).max(200) }),
});

export const subscribeToReminders = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.enum(["lucy", "manu"]), subscription: pushSubscriptionSchema }))
  .handler(async ({ data }) => {
    await savePushSubscription({ personId: data.personId, ...data.subscription });
    return { ok: true };
  });

export const unsubscribeFromReminders = createServerFn({ method: "POST" })
  .validator(z.object({ endpoint: z.string().url().max(2_000) }))
  .handler(async ({ data }) => {
    await removePushSubscription(data.endpoint);
    return { ok: true };
  });

export const undoTaskCompletion = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    await undoCompletion(data.id);
    invalidateCleaningCache();
    publishCleaningChange();
    return { ok: true };
  });

import { afterEach, describe, expect, test } from "bun:test";

import { enqueueOperation, queueSize, readQueue, removeOperation } from "./offline-queue";

const store = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
};

Object.assign(globalThis, {
  window: {
    localStorage,
    dispatchEvent: () => true,
  },
});

describe("offline queue", () => {
  afterEach(() => store.clear());

  test("keeps changes idempotent and removes synced operations", () => {
    const operation = {
      id: "same-id",
      type: "complete" as const,
      taskId: "cocina_comida",
      personId: "lucy" as const,
      createdAt: "2026-08-07T12:00:00.000Z",
    };
    enqueueOperation(operation);
    enqueueOperation(operation);
    expect(queueSize()).toBe(1);
    const queued = readQueue()[0];
    expect(queued?.type).toBe("complete");
    expect(queued?.type === "complete" ? queued.taskId : undefined).toBe("cocina_comida");
    removeOperation(operation.id);
    expect(queueSize()).toBe(0);
  });

  test("keeps a date and person correction ready for offline synchronization", () => {
    enqueueOperation({
      id: "edit-operation",
      type: "edit",
      completionId: "completion-id",
      personId: "lucy",
      completedAt: "2026-08-22T12:35:00.000Z",
      createdAt: "2026-08-22T16:00:00.000Z",
    });

    expect(readQueue()).toEqual([
      {
        id: "edit-operation",
        type: "edit",
        completionId: "completion-id",
        personId: "lucy",
        completedAt: "2026-08-22T12:35:00.000Z",
        createdAt: "2026-08-22T16:00:00.000Z",
      },
    ]);
  });
});

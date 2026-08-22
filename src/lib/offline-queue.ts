import type { PersonId } from "./cleaning";

const QUEUE_KEY = "happy-home:offline-queue";

export type QueuedOperation =
  | {
      id: string;
      type: "complete";
      taskId: string;
      personId: PersonId;
      createdAt: string;
      skipped?: boolean;
      lastError?: string;
    }
  | {
      id: string;
      type: "edit";
      completionId: string;
      personId: PersonId;
      completedAt: string;
      createdAt: string;
      lastError?: string;
    }
  | { id: string; type: "undo"; completionId: string; createdAt: string; lastError?: string };

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readQueue(): QueuedOperation[] {
  if (!storageAvailable()) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is QueuedOperation => {
      if (
        typeof row !== "object" ||
        row === null ||
        !("id" in row) ||
        typeof row.id !== "string" ||
        !("type" in row) ||
        !("createdAt" in row) ||
        typeof row.createdAt !== "string"
      ) {
        return false;
      }
      if (row.type === "complete") {
        return (
          "taskId" in row &&
          typeof row.taskId === "string" &&
          "personId" in row &&
          (row.personId === "lucy" || row.personId === "manu")
        );
      }
      if (row.type === "edit") {
        return (
          "completionId" in row &&
          typeof row.completionId === "string" &&
          "completedAt" in row &&
          typeof row.completedAt === "string" &&
          "personId" in row &&
          (row.personId === "lucy" || row.personId === "manu")
        );
      }
      return row.type === "undo" && "completionId" in row && typeof row.completionId === "string";
    });
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOperation[]): void {
  if (!storageAvailable()) return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event("happy-home-queue"));
}

export function enqueueOperation(operation: QueuedOperation): void {
  const queue = readQueue();
  if (queue.some((row) => row.id === operation.id)) return;
  writeQueue([...queue, operation]);
}

export function removeOperation(id: string): void {
  writeQueue(readQueue().filter((row) => row.id !== id));
}

export function markOperationFailed(id: string, message: string): void {
  writeQueue(
    readQueue().map((operation) =>
      operation.id === id ? { ...operation, lastError: message.slice(0, 160) } : operation,
    ),
  );
}

export function clearQueue(): void {
  writeQueue([]);
}

export function queueSize(): number {
  return readQueue().length;
}

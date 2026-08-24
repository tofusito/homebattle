import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type {
  CleaningData,
  Completion,
  PersonId,
  RewardVoucher,
  ScoreReceipt,
} from "@/lib/cleaning";
import {
  clearQueue,
  enqueueOperation,
  markOperationFailed,
  queueSize,
  readQueue,
  removeOperation,
} from "@/lib/offline-queue";
import {
  editTaskCompletion,
  getCleaningData,
  markTaskDone,
  redeemRewardVoucher,
  undoTaskCompletion,
  voteWeeklyPrizeRefresh,
} from "@/server/cleaning.functions";

const QUERY_KEY = ["cleaning-data"] as const;
const CACHE_KEY = "happy-home:data-cache";

// El intervalo de 30 s y el evento "online" pueden coincidir; este flag evita
// que dos flushes recorran la cola a la vez y dupliquen peticiones.
let flushingQueue = false;

function cacheData(data: CleaningData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

function cachedData(): CleaningData | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CACHE_KEY) ?? "",
    ) as Partial<CleaningData>;
    if (!parsed.people || !parsed.zones || !parsed.tasks || !parsed.completions) return undefined;
    return {
      ...parsed,
      people: parsed.people,
      zones: parsed.zones,
      tasks: parsed.tasks,
      completions: parsed.completions,
      settings: parsed.settings ?? {
        weeklyPrize: "Elegir el snack del fin de semana",
        weeklyRewardId: "weekend-snack",
        weeklyRewardWeekKey: "",
      },
      rewards: parsed.rewards ?? [],
    };
  } catch {
    return undefined;
  }
}

export function useCleaningData() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      try {
        const data = await getCleaningData();
        cacheData(data);
        return data;
      } catch (error) {
        const fallback = cachedData();
        if (fallback) return fallback;
        throw error;
      }
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useMarkDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      taskId,
      personId,
      completedAt,
      skipped,
    }: {
      id: string;
      taskId: string;
      personId: PersonId;
      assignedPersonId?: PersonId;
      completedAt: string;
      skipped?: boolean;
    }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOperation({
          id,
          type: "complete",
          taskId,
          personId,
          createdAt: completedAt,
          ...(skipped ? { skipped: true } : {}),
        });
        return {
          queued: true,
          receipt: undefined as ScoreReceipt | undefined,
          rewardEarned: undefined as RewardVoucher | undefined,
        };
      }
      try {
        const response = await markTaskDone({
          data: { id, taskId, personId, completedAt, ...(skipped ? { skipped: true } : {}) },
        });
        return {
          queued: false,
          receipt: response.receipt,
          rewardEarned: response.rewardEarned,
        };
      } catch (error) {
        if (!isConnectionFailure(error)) throw error;
        enqueueOperation({
          id,
          type: "complete",
          taskId,
          personId,
          createdAt: completedAt,
          ...(skipped ? { skipped: true } : {}),
        });
        return {
          queued: true,
          receipt: undefined as ScoreReceipt | undefined,
          rewardEarned: undefined as RewardVoucher | undefined,
        };
      }
    },
    onMutate: async ({ id, taskId, personId, assignedPersonId, completedAt, skipped }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<CleaningData>(QUERY_KEY);
      const completion: Completion = {
        id,
        taskId,
        personId,
        ...(assignedPersonId ? { assignedPersonId } : {}),
        completedAt,
        ...(skipped ? { skipped: true } : {}),
      };
      queryClient.setQueryData<CleaningData>(QUERY_KEY, (current) => {
        if (!current) return current;
        const next = {
          ...current,
          completions: [completion, ...current.completions.filter((row) => row.id !== id)],
        };
        cacheData(next);
        return next;
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSuccess: ({ queued }) => {
      if (!queued) void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useUndo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const operationId = crypto.randomUUID();
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOperation({
          id: operationId,
          type: "undo",
          completionId: id,
          createdAt: new Date().toISOString(),
        });
        return { queued: true };
      }
      try {
        await undoTaskCompletion({ data: { id } });
        return { queued: false };
      } catch (error) {
        if (!isConnectionFailure(error)) throw error;
        enqueueOperation({
          id: operationId,
          type: "undo",
          completionId: id,
          createdAt: new Date().toISOString(),
        });
        return { queued: true };
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<CleaningData>(QUERY_KEY);
      queryClient.setQueryData<CleaningData>(QUERY_KEY, (current) => {
        if (!current) return current;
        const next = {
          ...current,
          completions: current.completions.map((row) =>
            row.id === id ? { ...row, undoneAt: new Date().toISOString() } : row,
          ),
        };
        cacheData(next);
        return next;
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSuccess: ({ queued }) => {
      if (!queued) void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useEditCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      personId,
      completedAt,
    }: {
      id: string;
      personId: PersonId;
      completedAt: string;
      assignedPersonId?: PersonId;
    }) => {
      const operationId = crypto.randomUUID();
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOperation({
          id: operationId,
          type: "edit",
          completionId: id,
          personId,
          completedAt,
          createdAt: new Date().toISOString(),
        });
        return { queued: true, receipt: undefined as ScoreReceipt | undefined };
      }
      try {
        const response = await editTaskCompletion({ data: { id, personId, completedAt } });
        return { queued: false, receipt: response.receipt };
      } catch (error) {
        if (!isConnectionFailure(error)) throw error;
        enqueueOperation({
          id: operationId,
          type: "edit",
          completionId: id,
          personId,
          completedAt,
          createdAt: new Date().toISOString(),
        });
        return { queued: true, receipt: undefined as ScoreReceipt | undefined };
      }
    },
    onMutate: async ({ id, personId, assignedPersonId, completedAt }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<CleaningData>(QUERY_KEY);
      const editedAt = new Date().toISOString();
      queryClient.setQueryData<CleaningData>(QUERY_KEY, (current) => {
        if (!current) return current;
        const next = {
          ...current,
          completions: current.completions.map((completion) => {
            if (completion.id !== id) return completion;
            const { assignedPersonId: _previousAssignee, ...rest } = completion;
            return {
              ...rest,
              personId,
              completedAt,
              editedAt,
              ...(assignedPersonId ? { assignedPersonId } : {}),
            };
          }),
        };
        cacheData(next);
        return next;
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
    },
    onSuccess: ({ queued }) => {
      if (!queued) void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRedeemReward() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, personId }: { id: string; personId: PersonId }) =>
      redeemRewardVoucher({ data: { id, personId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useWeeklyPrizeRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: PersonId) => voteWeeklyPrizeRefresh({ data: { personId } }),
    onSuccess: ({ settings }) => {
      queryClient.setQueryData<CleaningData>(QUERY_KEY, (current) => {
        if (!current) return current;
        const next = { ...current, settings };
        cacheData(next);
        return next;
      });
    },
  });
}

export function useLiveSync(): {
  online: boolean;
  queued: number;
  live: boolean;
  blocked: boolean;
  retry: () => void;
  discard: () => void;
} {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [live, setLive] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setQueued(queueSize());
      setBlocked(readQueue().some((operation) => Boolean(operation.lastError)));
    };
    const flush = async () => {
      if (!navigator.onLine || flushingQueue) return;
      flushingQueue = true;
      try {
        await flushQueue();
      } finally {
        flushingQueue = false;
      }
      update();
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    };
    const flushQueue = async () => {
      for (const operation of readQueue()) {
        try {
          if (operation.type === "complete") {
            await markTaskDone({
              data: {
                id: operation.id,
                taskId: operation.taskId,
                personId: operation.personId,
                completedAt: operation.createdAt,
                ...(operation.skipped ? { skipped: true } : {}),
              },
            });
          } else if (operation.type === "edit") {
            await editTaskCompletion({
              data: {
                id: operation.completionId,
                personId: operation.personId,
                completedAt: operation.completedAt,
              },
            });
          } else {
            await undoTaskCompletion({ data: { id: operation.completionId } });
          }
          removeOperation(operation.id);
        } catch (error) {
          if (isConnectionFailure(error)) break;
          markOperationFailed(
            operation.id,
            error instanceof Error ? error.message : "No se pudo sincronizar este cambio",
          );
          break;
        }
      }
    };
    update();
    void flush();
    window.addEventListener("online", flush);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("happy-home-queue", update);
    const interval = window.setInterval(flush, 30_000);
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("happy-home-queue", update);
      window.clearInterval(interval);
    };
  }, [queryClient, retryToken]);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.addEventListener("open", () => setLive(true));
    events.addEventListener("cleaning", () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    );
    events.addEventListener("error", () => setLive(false));
    return () => events.close();
  }, [queryClient]);

  return {
    online,
    queued,
    live,
    blocked,
    retry: () => {
      for (const operation of readQueue()) {
        if (operation.lastError) markOperationFailed(operation.id, "");
      }
      setRetryToken((value) => value + 1);
    },
    discard: () => {
      clearQueue();
      setQueued(0);
      setBlocked(false);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  };
}

function isConnectionFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("failed to fetch") || message.includes("networkerror");
}

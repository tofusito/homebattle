import * as Dialog from "@radix-ui/react-dialog";
import { Bell, History, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  formatHistoryWhen,
  isRescueCompletion,
  personById,
  type Completion,
  type Person,
  type PersonId,
  type Task,
  type Zone,
} from "@/lib/cleaning";
import { cn } from "@/lib/utils";

function activityAt(completion: Completion): string {
  return completion.recordedAt ?? completion.completedAt;
}

export function ActivityBell({
  completions,
  tasks,
  zones,
  people,
  currentPerson,
  onViewHistory,
}: {
  completions: Completion[];
  tasks: Task[];
  zones: Zone[];
  people: Person[];
  currentPerson: PersonId;
  onViewHistory: () => void;
}) {
  const storageKey = `happy-home:last-seen-activity:${currentPerson}`;
  const active = useMemo(
    () =>
      completions
        .filter((completion) => !completion.undoneAt)
        .sort((a, b) => new Date(activityAt(b)).getTime() - new Date(activityAt(a)).getTime()),
    [completions],
  );
  const newestAt = active[0] ? activityAt(active[0]) : new Date().toISOString();
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const zonesById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const initial = stored ?? newestAt;
    if (!stored) window.localStorage.setItem(storageKey, initial);
    setLastSeenAt(initial);
  }, [newestAt, storageKey]);

  useEffect(() => {
    if (!seenIds.current) {
      seenIds.current = new Set(active.map((completion) => completion.id));
      return;
    }
    for (const completion of active) {
      if (seenIds.current.has(completion.id)) continue;
      seenIds.current.add(completion.id);
      if (completion.personId === currentPerson || isRescueCompletion(completion)) continue;
      const actor = personById(people, completion.personId);
      const task = tasksById.get(completion.taskId);
      toast(`${actor.emoji} ${actor.label} ha hecho una tarea`, {
        description: task?.name ?? "Nueva actividad en casa",
      });
    }
  }, [active, currentPerson, people, tasksById]);

  const unread = lastSeenAt
    ? active.filter(
        (completion) =>
          completion.personId !== currentPerson &&
          new Date(activityAt(completion)).getTime() > new Date(lastSeenAt).getTime(),
      ).length
    : 0;
  const markSeen = () => {
    window.localStorage.setItem(storageKey, newestAt);
    setLastSeenAt(newestAt);
  };

  return (
    <Dialog.Root onOpenChange={(open) => open && markSeen()}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Actividad reciente, ${unread} nuevas` : "Actividad reciente"}
          className="card-soft tap-shrink relative grid size-10 place-items-center rounded-full text-muted-foreground"
        >
          <Bell className="size-4.5" />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-late px-1 text-[0.65rem] leading-5 font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Content className="card-soft fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-2xl font-semibold">Actividad reciente</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Las últimas cosas que habéis hecho en casa.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 place-items-center rounded-full bg-secondary">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <ol className="mt-5 space-y-2">
            {active.length === 0 ? (
              <li className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                Todavía no hay actividad.
              </li>
            ) : (
              active.slice(0, 5).map((completion) => {
                const actor = personById(people, completion.personId);
                const task = tasksById.get(completion.taskId);
                const zone = task ? zonesById.get(task.zoneId) : null;
                const rescue = isRescueCompletion(completion);
                return (
                  <li
                    key={completion.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border border-border/70 bg-card/75 px-3 py-3",
                      rescue && "border-rescue/25 bg-rescue-soft/45",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full",
                        rescue
                          ? "bg-rescue-soft text-rescue"
                          : actor.id === "lucy"
                            ? "bg-lucy-soft"
                            : "bg-manu-soft",
                      )}
                    >
                      {rescue ? <Sparkles className="size-4" /> : actor.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {completion.skipped
                          ? completion.taskId === "cocina_comida"
                            ? "Hoy no se comió en casa"
                            : "Hoy no se cenó en casa"
                          : (task?.name ?? "Tarea")}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {actor.label} · {zone?.label ?? "Casa"} ·{" "}
                        {formatHistoryWhen(completion.completedAt)}
                      </span>
                    </span>
                  </li>
                );
              })
            )}
          </ol>

          <Dialog.Close asChild>
            <button
              type="button"
              onClick={onViewHistory}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 text-sm font-semibold"
            >
              <History className="size-4" /> Ver todo el registro
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

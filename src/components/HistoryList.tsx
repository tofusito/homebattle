import { ChevronsRight, Pencil, Sparkles, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useEditCompletion } from "@/hooks/use-cleaning-data";
import {
  formatHistoryWhen,
  isRescueCompletion,
  personById,
  startOfWeek,
  type Completion,
  type Person,
  type Task,
  type Zone,
} from "@/lib/cleaning";
import { cn } from "@/lib/utils";

import { CompletionEditorDialog } from "./CompletionEditorDialog";

type PeriodFilter = "all" | "today" | "week";
type KindFilter = "all" | "lucy" | "manu" | "rescues";

export function HistoryList({
  completions,
  tasks,
  zones,
  people,
  onUndo,
}: {
  completions: Completion[];
  tasks: Task[];
  zones: Zone[];
  people: Person[];
  onUndo: (id: string) => void;
}) {
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [editing, setEditing] = useState<Completion | null>(null);
  const edit = useEditCompletion();
  const byTask = new Map(tasks.map((task) => [task.id, task]));
  const byZone = new Map(zones.map((zone) => [zone.id, zone]));
  const now = new Date();
  const todayKey = now.toLocaleDateString("en-CA");
  const weekStart = startOfWeek(now);
  const active = completions.filter((row) => {
    if (row.undoneAt) return false;
    const completedAt = new Date(row.completedAt);
    if (period === "today" && completedAt.toLocaleDateString("en-CA") !== todayKey) return false;
    if (period === "week" && completedAt < weekStart) return false;
    if (kind === "rescues") return isRescueCompletion(row);
    if (kind !== "all" && row.personId !== kind) return false;
    return true;
  });

  return (
    <div>
      <FilterRow
        label="Filtrar por fecha"
        value={period}
        onChange={setPeriod}
        options={[
          ["all", "Todo"],
          ["today", "Hoy"],
          ["week", "Esta semana"],
        ]}
      />
      <FilterRow
        label="Filtrar por persona o tipo"
        value={kind}
        onChange={setKind}
        options={[
          ["all", "Los dos"],
          ["lucy", "🦄 Lucy"],
          ["manu", "🐱 Manu"],
          ["rescues", "✨ Rescates"],
        ]}
      />

      {active.length === 0 ? (
        <div className="card-soft animate-rise-in rounded-3xl p-7 text-center">
          <p className="text-4xl">🧹</p>
          <h2 className="mt-3 text-xl font-semibold">Nada por aquí con estos filtros</h2>
          <p className="mt-2 text-sm text-muted-foreground">Prueba otra fecha o persona.</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {active.slice(0, 100).map((completion, index) => {
            const task = byTask.get(completion.taskId);
            const person = personById(people, completion.personId);
            const rescue = isRescueCompletion(completion);
            const skipped = Boolean(completion.skipped);
            const owner =
              rescue && completion.assignedPersonId
                ? personById(people, completion.assignedPersonId)
                : null;
            return (
              <li
                key={completion.id}
                className={cn(
                  "animate-rise-in card-soft flex items-center gap-3 rounded-2xl px-4 py-3",
                  rescue && "border-rescue/30 bg-rescue-soft/45",
                  skipped && "border-primary/15 bg-secondary/45",
                )}
                style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full text-base",
                    skipped
                      ? "bg-secondary text-primary"
                      : rescue
                        ? "bg-rescue-soft text-rescue"
                        : person.id === "lucy"
                          ? "bg-lucy-soft"
                          : "bg-manu-soft",
                  )}
                >
                  {skipped ? (
                    <ChevronsRight className="size-4" strokeWidth={2.5} />
                  ) : rescue ? (
                    <Sparkles className="size-4" />
                  ) : (
                    person.emoji
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {task
                      ? `${byZone.get(task.zoneId)?.label ?? task.zoneId} · ${task.name}`
                      : "Tarea"}
                  </p>
                  {skipped ? (
                    <p className="text-xs font-semibold text-primary">
                      {completion.taskId === "cocina_comida"
                        ? "Hoy no se come en casa"
                        : "Hoy no se cena en casa"}{" "}
                      · sin puntos · {formatHistoryWhen(completion.completedAt)}
                    </p>
                  ) : rescue && owner ? (
                    <p className="text-xs text-rescue">
                      {person.label} la hizo · era de {owner.label} · +1/−1 ·{" "}
                      {formatHistoryWhen(completion.completedAt)}
                    </p>
                  ) : completion.waivedByRewardId && completion.waivedOwnerId ? (
                    <p className="text-xs font-semibold text-soon">
                      Vale de {personById(people, completion.waivedOwnerId).label} · relevo sin
                      penalización · {formatHistoryWhen(completion.completedAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {person.label} · {formatHistoryWhen(completion.completedAt)}
                      {completion.editedAt ? " · hora corregida" : ""}
                    </p>
                  )}
                </div>
                {!completion.waivedByRewardId ? (
                  <button
                    type="button"
                    onClick={() => setEditing(completion)}
                    aria-label="Editar fecha, hora o persona"
                    className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                  >
                    <Pencil className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onUndo(completion.id)}
                  aria-label="Deshacer este registro"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-late-soft hover:text-destructive"
                >
                  <Undo2 className="size-5" />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <CompletionEditorDialog
        completion={editing}
        completions={completions}
        tasks={tasks}
        people={people}
        open={Boolean(editing)}
        saving={edit.isPending}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(change) =>
          edit.mutate(change, {
            onSuccess: ({ queued }) => {
              setEditing(null);
              toast.success(queued ? "Cambio guardado en este móvil" : "Registro actualizado", {
                description: queued
                  ? "Se sincronizará cuando vuelva la conexión."
                  : "La fecha, la hora y los turnos se han recalculado.",
              });
            },
            onError: (error) =>
              toast.error("No se ha podido actualizar", {
                description:
                  error instanceof Error ? error.message : "Revisa la fecha e inténtalo de nuevo.",
              }),
          })
        }
      />
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<readonly [T, string]>;
}) {
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label={label}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold",
            value === option ? "bg-primary text-primary-foreground" : "card-soft",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

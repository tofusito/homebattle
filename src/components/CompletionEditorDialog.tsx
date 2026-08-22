import * as Dialog from "@radix-ui/react-dialog";
import { CalendarClock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  assignedPersonForTask,
  localDateKey,
  madridDateTimeToIso,
  madridTimeKey,
  personById,
  type Completion,
  type Person,
  type PersonId,
  type Task,
} from "@/lib/cleaning";
import { cn } from "@/lib/utils";

interface CompletionEdit {
  id: string;
  personId: PersonId;
  completedAt: string;
  assignedPersonId?: PersonId;
}

export function CompletionEditorDialog({
  completion,
  completions,
  tasks,
  people,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  completion: Completion | null;
  completions: Completion[];
  tasks: Task[];
  people: Person[];
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (edit: CompletionEdit) => void;
}) {
  const [dateKey, setDateKey] = useState("");
  const [timeKey, setTimeKey] = useState("");
  const [personId, setPersonId] = useState<PersonId>("manu");

  useEffect(() => {
    if (!completion) return;
    const completedAt = new Date(completion.completedAt);
    setDateKey(localDateKey(completedAt));
    setTimeKey(madridTimeKey(completedAt));
    setPersonId(completion.personId);
  }, [completion]);

  const task = completion ? tasks.find((candidate) => candidate.id === completion.taskId) : null;
  const completedAt = useMemo(() => {
    if (!dateKey || !timeKey) return null;
    try {
      return madridDateTimeToIso(dateKey, timeKey);
    } catch {
      return null;
    }
  }, [dateKey, timeKey]);
  const assignedPersonId =
    task && completedAt
      ? assignedPersonForTask(
          task,
          tasks,
          new Date(completedAt),
          completions.filter((row) => row.id !== completion?.id && !row.undoneAt),
        )
      : null;
  const future = Boolean(completedAt && new Date(completedAt).getTime() > Date.now() + 60_000);
  const missingSource = task?.schedule.type === "linked" && !assignedPersonId;
  const invalidSkip = Boolean(completion?.skipped && assignedPersonId !== personId);
  const lockedVoucher = Boolean(completion?.waivedByRewardId);
  const rescue = Boolean(!completion?.skipped && assignedPersonId && assignedPersonId !== personId);
  const actor = personById(people, personId);
  const owner = assignedPersonId ? personById(people, assignedPersonId) : null;
  const canSave = Boolean(
    completion &&
    task &&
    completedAt &&
    !future &&
    !missingSource &&
    !invalidSkip &&
    !lockedVoucher,
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Content className="card-soft fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="mb-2 grid size-11 place-items-center rounded-2xl bg-secondary text-primary">
                <CalendarClock className="size-5" />
              </span>
              <Dialog.Title className="text-2xl font-semibold">Ajustar el registro</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {task?.name ?? "Tarea"} · indica cuándo se hizo realmente.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 place-items-center rounded-full bg-secondary">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">
              Día
              <input
                type="date"
                value={dateKey}
                max={localDateKey()}
                onChange={(event) => setDateKey(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Hora
              <input
                type="time"
                value={timeKey}
                onChange={(event) => setTimeKey(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              />
            </label>
          </div>

          <fieldset className="mt-4" disabled={Boolean(completion?.skipped)}>
            <legend className="text-xs font-semibold text-muted-foreground">Quién la hizo</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => setPersonId(person.id)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-sm font-semibold",
                    personId === person.id
                      ? person.id === "lucy"
                        ? "border-lucy/40 bg-lucy-soft text-lucy"
                        : "border-manu/40 bg-manu-soft text-manu"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {person.emoji} {person.label}
                </button>
              ))}
            </div>
          </fieldset>

          {rescue && owner ? (
            <div className="mt-4 rounded-2xl border border-rescue/25 bg-rescue-soft/60 p-3 text-sm">
              <p className="font-semibold text-rescue">Este cambio crea un rescate</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {actor.label} figura como quien la hizo y era turno de {owner.label}. Se
                recalcularán los puntos correspondientes.
              </p>
            </div>
          ) : null}
          {future ? <EditorWarning text="La hora no puede estar en el futuro." /> : null}
          {missingSource ? (
            <EditorWarning text="Primero debe existir la comida, cena o lavadora que activó esta tarea." />
          ) : null}
          {invalidSkip ? (
            <EditorWarning text="Una comida saltada debe permanecer a nombre de quien tenía el turno." />
          ) : null}
          {lockedVoucher ? (
            <EditorWarning text="Este registro consumió un vale. Deshazlo y vuelve a marcarlo para cambiarlo con seguridad." />
          ) : null}

          <div className="mt-5 flex gap-2">
            <Dialog.Close className="min-h-11 flex-1 rounded-xl bg-secondary px-4 text-sm font-semibold">
              Cancelar
            </Dialog.Close>
            <button
              type="button"
              disabled={!canSave || saving}
              onClick={() => {
                if (!completion || !completedAt || !canSave) return;
                onSave({
                  id: completion.id,
                  personId,
                  completedAt,
                  ...(assignedPersonId ? { assignedPersonId } : {}),
                });
              }}
              className={cn(
                "min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50",
                rescue ? "bg-rescue" : "bg-primary",
              )}
            >
              {saving ? "Guardando…" : rescue ? "Confirmar rescate" : "Guardar cambios"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditorWarning({ text }: { text: string }) {
  return (
    <p className="mt-4 rounded-2xl bg-late-soft px-3 py-2 text-xs font-semibold text-late">
      {text}
    </p>
  );
}

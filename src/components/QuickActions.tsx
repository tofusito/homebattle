import { Check, Sparkles } from "lucide-react";

import { isTaskStateSatisfied, type Person, type TaskState } from "@/lib/cleaning";
import { cn } from "@/lib/utils";

export function QuickActions({
  states,
  person,
  onDone,
}: {
  states: TaskState[];
  person: Person;
  onDone: (taskId: string) => void;
}) {
  if (states.length === 0) return null;
  return (
    <section className="animate-rise-in">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Atajos de casa</h2>
          <p className="text-sm text-muted-foreground">Lo más habitual, sin abrir ninguna zona.</p>
        </div>
        <Sparkles className="size-5 text-primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {states.slice(0, 4).map((state) => {
          const completed = isTaskStateSatisfied(state);
          const repeatable = (state.completionLimit ?? 1) > 1;
          return (
            <button
              key={state.task.id}
              type="button"
              disabled={completed}
              onClick={() => onDone(state.task.id)}
              className={cn(
                "tap-shrink card-soft min-h-28 rounded-2xl p-3 text-left disabled:cursor-default disabled:opacity-65",
                person.id === "lucy" ? "hover:border-lucy/45" : "hover:border-manu/45",
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full",
                  person.id === "lucy" ? "bg-lucy-soft text-lucy" : "bg-manu-soft text-manu",
                )}
              >
                <Check className="size-5" />
              </span>
              <span className="mt-2 block text-xs leading-tight font-semibold">
                {shortTaskName(state.task.name)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {repeatable
                  ? completed
                    ? `✓ ${state.completionCount}/${state.completionLimit} hoy`
                    : `🏆 ${state.completionCount}/${state.completionLimit} hoy · suma 1`
                  : completed
                    ? "✓ Hecho hoy"
                    : state.task.points > 0
                      ? "🏆 Suma 1 punto"
                      : "✓ No suma puntos"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function shortTaskName(name: string): string {
  return name
    .replace("Llenar de agua el ", "Llenar agua ")
    .replace("Llenar la comida de los gatos", "Llenar comida")
    .replace("Poner el ", "Poner ")
    .replace("Recoger el ", "Recoger ");
}

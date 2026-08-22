import { ArrowRight, Trophy } from "lucide-react";

import { leagueScores, startOfWeek, type Completion, type Person, type Task } from "@/lib/cleaning";
import { cn } from "@/lib/utils";

export function TodayLeagueChip({
  completions,
  tasks,
  person,
  onOpen,
}: {
  completions: Completion[];
  tasks: Task[];
  person: Person;
  onOpen: () => void;
}) {
  const scores = leagueScores(completions, tasks, startOfWeek());
  const otherScore = person.id === "lucy" ? scores.manu : scores.lucy;
  const ownScore = scores[person.id];
  const difference = ownScore - otherScore;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap-shrink card-soft flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-soon-soft text-soon">
        <Trophy className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Tus puntos esta semana: {ownScore}</span>
        <span
          className={cn(
            "block text-xs",
            difference > 0 ? "text-fresh" : difference < 0 ? "text-soon" : "text-muted-foreground",
          )}
        >
          {difference === 0
            ? "Empate. La siguiente cuenta."
            : difference > 0
              ? `Vas ${difference} por delante.`
              : `Estás a ${Math.abs(difference)} de empatar.`}
        </span>
      </span>
      <ArrowRight className="size-5 text-muted-foreground" />
    </button>
  );
}

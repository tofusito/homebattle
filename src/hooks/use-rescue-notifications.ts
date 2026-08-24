import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  isRescueCompletion,
  personById,
  type Completion,
  type Person,
  type PersonId,
} from "@/lib/cleaning";

export function useRescueNotifications(
  completions: Completion[],
  people: Person[],
  currentPerson: PersonId | null,
) {
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const active = completions.filter((completion) => !completion.undoneAt);
    if (!seen.current) {
      seen.current = new Set(active.map((completion) => completion.id));
      return;
    }
    for (const completion of active) {
      if (seen.current.has(completion.id)) continue;
      seen.current.add(completion.id);
      if (
        !currentPerson ||
        completion.assignedPersonId !== currentPerson ||
        !isRescueCompletion(completion)
      ) {
        continue;
      }
      const actor = personById(people, completion.personId);
      toast.warning(`${actor.emoji} ${actor.label} ha rescatado una tarea tuya`, {
        description: "Has cedido 1 punto esta semana.",
      });
    }
  }, [completions, currentPerson, people]);
}

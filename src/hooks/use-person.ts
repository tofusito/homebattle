import { useEffect, useState } from "react";

import type { Person, PersonId } from "@/lib/cleaning";

const KEY = "happy-home:quien-soy";

export function usePerson(people: Person[]) {
  const [person, setPerson] = useState<PersonId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored && people.some((candidate) => candidate.id === stored)) {
      setPerson(stored as PersonId);
    }
    setReady(true);
  }, [people]);

  const choose = (next: PersonId) => {
    localStorage.setItem(KEY, next);
    setPerson(next);
  };

  const forget = () => {
    localStorage.removeItem(KEY);
    setPerson(null);
  };

  return { person, ready, choose, forget };
}

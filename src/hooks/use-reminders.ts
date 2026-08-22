import { useEffect } from "react";

import type { Preferences } from "@/hooks/use-preferences";
import type { PersonId, TaskState } from "@/lib/cleaning";

function reminderHour(state: TaskState): number | undefined {
  if (!("preferredPeriod" in state.task.schedule)) return undefined;
  return state.task.schedule.preferredPeriod === "lunch" ? 13 : 21;
}

export function useGentleReminders(
  states: TaskState[],
  person: PersonId | null,
  preferences: Preferences,
): void {
  useEffect(() => {
    if (!preferences.reminders || !person || typeof Notification === "undefined") return;
    let pushActive = false;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.pushManager?.getSubscription())
        .then((subscription) => {
          pushActive = Boolean(subscription);
        })
        .catch(() => undefined);
    }
    const check = () => {
      if (pushActive) return;
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const dateKey = now.toLocaleDateString("en-CA");
      for (const state of states) {
        const hour = reminderHour(state);
        if (
          hour === undefined ||
          now.getHours() < hour ||
          state.status === "fresh" ||
          state.assignedTo !== person
        )
          continue;
        const key = `happy-home:reminder:${dateKey}:${state.task.id}`;
        if (window.localStorage.getItem(key)) continue;
        new Notification("Happy Home", {
          body: `${state.task.name} te está esperando con cariño.`,
          icon: "/icons/icon-home-sparkle-192.png",
          tag: key,
        });
        window.localStorage.setItem(key, "sent");
      }
    };
    check();
    const interval = window.setInterval(check, 60_000);
    return () => window.clearInterval(interval);
  }, [person, preferences.reminders, states]);
}

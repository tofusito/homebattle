import { useEffect, useState } from "react";

export interface Preferences {
  haptics: boolean;
  sound: boolean;
  reminders: boolean;
  reducedMotion: boolean;
}

const STORAGE_KEY = "happy-home:preferences";
const DEFAULTS: Preferences = {
  haptics: true,
  sound: false,
  reminders: false,
  reducedMotion: false,
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) ?? "{}",
      ) as Partial<Preferences>;
      setPreferences({ ...DEFAULTS, ...saved });
    } catch {
      setPreferences(DEFAULTS);
    }
  }, []);

  const setPreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { preferences, setPreference };
}

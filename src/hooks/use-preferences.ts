import { useEffect, useState } from "react";

import { applyTheme, type ThemePreference } from "@/lib/theme";

export interface Preferences {
  haptics: boolean;
  sound: boolean;
  reminders: boolean;
  reducedMotion: boolean;
  theme: ThemePreference;
}

const STORAGE_KEY = "happy-home:preferences";
const DEFAULTS: Preferences = {
  haptics: true,
  sound: false,
  reminders: false,
  reducedMotion: false,
  theme: "system",
};

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) ?? "{}",
      ) as Partial<Preferences>;
      const merged = { ...DEFAULTS, ...saved };
      setPreferences(merged);
      applyTheme(merged.theme);
    } catch {
      setPreferences(DEFAULTS);
    }
  }, []);

  // Con tema "system", seguir los cambios de esquema del sistema en caliente.
  useEffect(() => {
    if (preferences.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preferences.theme]);

  const setPreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applyTheme(next.theme);
      return next;
    });
  };

  return { preferences, setPreference };
}

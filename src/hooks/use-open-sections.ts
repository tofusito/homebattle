import { useEffect, useState } from "react";

export function useOpenSections(storageKey: string) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
      if (Array.isArray(saved)) {
        setOpen(new Set(saved.filter((value): value is string => typeof value === "string")));
      }
    } catch {
      setOpen(new Set());
    }
  }, [storageKey]);

  const setSectionOpen = (id: string, isOpen: boolean) => {
    setOpen((current) => {
      const next = new Set(current);
      if (isOpen) next.add(id);
      else next.delete(id);
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  };

  return {
    isSectionOpen: (id: string) => open.has(id),
    setSectionOpen,
  };
}

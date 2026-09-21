import { Home, ListChecks, Trophy, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

export type Tab = "hoy" | "zonas" | "liga" | "perfil";

const TABS = [
  { id: "hoy" as const, label: "Hoy", icon: Home },
  { id: "zonas" as const, label: "Zonas", icon: ListChecks },
  { id: "liga" as const, label: "Liga", icon: Trophy },
  { id: "perfil" as const, label: "Perfil", icon: UserRound },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="safe-nav fixed inset-x-0 bottom-0 z-40 px-4 pt-2">
      <div className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-[var(--shadow-lift)] backdrop-blur-xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-2 text-xs font-semibold transition-all duration-200",
              tab === id
                ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <Icon className="size-4" strokeWidth={2.1} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

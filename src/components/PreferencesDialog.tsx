import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { Bell, Moon, Settings2, Sun, SunMoon, Volume2, Vibrate, X, ZapOff } from "lucide-react";

import type { Preferences } from "@/hooks/use-preferences";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Props {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  onForget: () => void;
  onRemindersChange: (enabled: boolean) => Promise<boolean>;
  remindersBusy: boolean;
}

export function PreferencesDialog({
  preferences,
  setPreference,
  onForget,
  onRemindersChange,
  remindersBusy,
}: Props) {
  const enableReminders = async (enabled: boolean) => {
    try {
      const active = await onRemindersChange(enabled);
      setPreference("reminders", active);
    } catch {
      setPreference("reminders", false);
    }
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir preferencias"
          className="card-soft tap-shrink grid size-10 place-items-center rounded-full text-muted-foreground"
        >
          <Settings2 className="size-4.5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Content className="card-soft fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-2xl font-semibold">A vuestro gusto</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Pequeños detalles para que marcar una tarea se sienta bien.
              </Dialog.Description>
            </div>
            <Dialog.Close className="grid size-9 place-items-center rounded-full bg-secondary">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="mt-5">
            <p className="text-sm font-semibold">Aspecto</p>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPreference("theme", value)}
                  className={cn(
                    "flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors",
                    preferences.theme === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 divide-y divide-border/70">
            <PreferenceRow
              icon={Vibrate}
              title="Vibración suave"
              detail="Una pequeña respuesta al completar."
              checked={preferences.haptics}
              onCheckedChange={(value) => setPreference("haptics", value)}
            />
            <PreferenceRow
              icon={Volume2}
              title="Sonido de celebración"
              detail="Un acorde breve, apagado por defecto."
              checked={preferences.sound}
              onCheckedChange={(value) => setPreference("sound", value)}
            />
            <PreferenceRow
              icon={Bell}
              title="Recordatorios amables"
              detail="Si está instalada, avisa también cuando Happy Home está cerrada."
              checked={preferences.reminders}
              onCheckedChange={enableReminders}
              disabled={remindersBusy}
            />
            <PreferenceRow
              icon={ZapOff}
              title="Reducir movimiento"
              detail="Quita confeti y animaciones decorativas."
              checked={preferences.reducedMotion}
              onCheckedChange={(value) => setPreference("reducedMotion", value)}
            />
          </div>
          <button
            type="button"
            onClick={onForget}
            className="mt-5 w-full rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground"
          >
            Cambiar de persona
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: SunMoon },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
];

function PreferenceRow({
  icon: Icon,
  title,
  detail,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  icon: typeof Bell;
  title: string;
  detail: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative h-7 w-12 shrink-0 rounded-full bg-muted transition-colors data-[state=checked]:bg-accent"
      >
        <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-6" />
      </Switch.Root>
    </div>
  );
}

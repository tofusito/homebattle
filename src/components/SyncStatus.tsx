import { CheckCircle2, CloudOff, RefreshCw, Radio } from "lucide-react";

import { cn } from "@/lib/utils";

export function SyncStatus({
  online,
  queued,
  live,
  fetching,
  blocked,
  onRetry,
  onDiscard,
}: {
  online: boolean;
  queued: number;
  live: boolean;
  fetching: boolean;
  blocked: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const Icon = !online
    ? CloudOff
    : queued > 0 || fetching
      ? RefreshCw
      : live
        ? Radio
        : CheckCircle2;
  const label = blocked
    ? "Hay un cambio que necesita atención"
    : !online
      ? queued > 0
        ? `Sin conexión · ${queued} ${queued === 1 ? "cambio guardado" : "cambios guardados"}`
        : "Sin conexión · puedes seguir marcando"
      : queued > 0
        ? `Sincronizando ${queued} ${queued === 1 ? "cambio" : "cambios"}`
        : live
          ? "Al día en los dos móviles"
          : "Todo guardado";
  return (
    <div className="mx-auto mt-8 w-fit max-w-full rounded-2xl bg-card/65 px-3 py-2 text-xs font-semibold text-muted-foreground">
      <p className="flex items-center justify-center gap-2">
        <Icon className={cn("size-4", !blocked && (queued > 0 || fetching) && "animate-spin")} />
        {label}
      </p>
      {blocked ? (
        <div className="mt-2 flex justify-center gap-2">
          <button type="button" onClick={onRetry} className="min-h-11 rounded-xl bg-secondary px-3">
            Reintentar
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-11 rounded-xl px-3 text-destructive"
          >
            Descartar
          </button>
        </div>
      ) : null}
    </div>
  );
}

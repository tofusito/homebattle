import { addDaysKey, localDateKey, type ScoreReceipt, type TaskState } from "@/lib/cleaning";
import { CELEBRATIONS } from "@/lib/copy";

export function completionFeedback(
  queued: boolean,
  receipt: ScoreReceipt | undefined,
  taskName: string,
  actorName: string,
  ownerName?: string,
): { title: string; description: string } {
  if (queued) {
    return {
      title: "Guardado en este móvil",
      description: `${taskName} se sincronizará cuando vuelva la conexión.`,
    };
  }
  if (!receipt || receipt.reason === "non_competitive") {
    return {
      title: "Hecha y registrada ✓",
      description: `${taskName} · queda en el registro, pero no suma puntos.`,
    };
  }
  if (receipt.waived) {
    return {
      title: "🛋️ Vale aplicado: relevo sin penalización",
      description: `${taskName} suma para ${actorName} y no resta ningún punto.`,
    };
  }
  if (receipt.reason === "repeated") {
    return {
      title: "Hecha y registrada ✓",
      description: `${taskName} ya había puntuado en este periodo, así que no suma otra vez.`,
    };
  }
  if (receipt.rescue && ownerName) {
    return {
      title: `✨ Rescate: +${receipt.points} para ${actorName}`,
      description: `${taskName} · ${ownerName} cede ${receipt.points} punto.`,
    };
  }
  return {
    title: CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]!,
    description: `Has ganado ${receipt.points} punto esta semana · ${taskName} · a nombre de ${actorName}`,
  };
}

export function completionTimestampForState(state: TaskState): string {
  if (!state.occurrenceDate) return new Date().toISOString();
  const now = new Date();
  const yesterday = addDaysKey(localDateKey(now), -1);
  if (state.occurrenceDate !== yesterday) return now.toISOString();
  return new Date(now.getTime() - 24 * 60 * 60 * 1_000).toISOString();
}

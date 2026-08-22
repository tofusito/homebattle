import type { PersonId, Status } from "./cleaning";

export const APP_NAME = "Happy Home";
export const APP_TAGLINE = "La casa no se coordina sola";

export const CELEBRATIONS = [
  "¡BOOM! Tarea fulminada 💥",
  "Esto merece un aplauso y una cerveza 🍻",
  "La suciedad ha huido llorando 😭",
  "Nivel de casa: aceptable para visitas 👀",
  "Se te va a caer la medalla 🏅",
];

export const STATUS_COPY: Record<Status, string> = {
  fresh: "Al día",
  later: "Más tarde",
  soon: "En turno",
  late: "Pendiente",
  on_demand: "A demanda",
};

export function streakCopy(streak: number): string {
  if (streak === 0) return "Sin racha. Empezad hoy y presumid mañana.";
  if (streak === 1) return "Primera semana. El principio de algo grande.";
  if (streak < 5) return `${streak} semanas seguidas. Esto ya es una relación seria.`;
  return `${streak} semanas. Leyendas del cubo y la fregona.`;
}

export function greetingFor(person: PersonId, name: string): string {
  const hour = new Date().getHours();
  if (hour < 7) return `${name}, ¿qué haces despierto? Vuelve a la cama.`;
  if (hour < 13) return `Buenos días, ${name}`;
  if (hour < 20) return `Buenas tardes, ${name}`;
  return `Buenas noches, ${name}`;
}

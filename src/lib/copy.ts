import type { PersonId, Status } from "./cleaning";

function pick<T>(items: T[], seed = Math.random()): T {
  return items[Math.floor(seed * items.length) % items.length]!;
}

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

export function shameFor(taskName: string, index = 0): string {
  const defaults = [
    "Esto lleva demasiado tiempo llorando en silencio.",
    "La tarea os está juzgando desde su rincón.",
    "Nivel de dejadez: preocupante pero reversible.",
  ];
  if (taskName.toLowerCase().includes("encimera")) return "Las migas están planeando algo.";
  if (taskName.toLowerCase().includes("suelo")) return "El suelo ya reclama derechos de inquilino.";
  return defaults[index % defaults.length]!;
}

export function emptyDayCopy(): string {
  return pick([
    "Todo al día. Sospechoso, pero disfrutadlo.",
    "Cero tareas pendientes. Modo sofá activado 🛋️",
    "La casa está en paz. Los gatos probablemente no.",
  ]);
}

export function scoreTaunt(
  first: number,
  second: number,
  firstName: string,
  secondName: string,
): string {
  if (first === 0 && second === 0) return "Empate a cero. Un equipo unido en la contemplación.";
  if (first === second) return "Empate técnico. Que nadie se venga arriba.";
  const leader = first > second ? firstName : secondName;
  const trailing = first > second ? secondName : firstName;
  return `${leader} va por delante. ${trailing}, aún hay remontada 👀`;
}

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

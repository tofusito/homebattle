export interface RewardDefinition {
  id: string;
  emoji: string;
  title: string;
  detail: string;
}

export const REWARD_CATALOG: RewardDefinition[] = [
  {
    id: "next-restaurant",
    emoji: "🍽️",
    title: "Elegir restaurante la próxima vez que comamos fuera",
    detail: "La otra persona acepta la elección sin abrir una cumbre gastronómica.",
  },
  {
    id: "skip-next-task",
    emoji: "🛋️",
    title: "Vale por librarse de una tarea siguiente",
    detail: "Se usa en una tarea no urgente y la otra persona toma el relevo sin penalización.",
  },
  {
    id: "weekend-treat",
    emoji: "🍔",
    title: "Elegir el gocheo del fin de semana",
    detail: "Quien gana elige ese antojo especial que convierte el fin de semana en fin de semana.",
  },
  {
    id: "choose-cooked-meal",
    emoji: "👩‍🍳",
    title: "Elegir qué cocina el otro cuando le toque comida o cena",
    detail:
      "La elección debe ser razonable y se usa cuando a la otra persona le corresponda cocinar.",
  },
  {
    id: "reasonable-errand",
    emoji: "🛍️",
    title: "Vale para que el otro haga un recado razonable",
    detail: "Un recado cercano, asumible y que pueda hacerse sin convertirlo en una expedición.",
  },
  {
    id: "weekend-breakfast",
    emoji: "☕",
    title: "Elegir el desayuno del fin de semana y que el otro lo prepare",
    detail:
      "También puede ir a buscarlo: quien gana elige y la otra persona lo prepara o consigue.",
  },
  {
    id: "reasonable-invitation",
    emoji: "🍰",
    title: "Vale por una invitación razonable",
    detail: "La otra persona invita a un dulce, café, snack o algo de comida de importe razonable.",
  },
];

export const DEFAULT_REWARD = REWARD_CATALOG[0]!;

export function rewardById(id: string): RewardDefinition {
  return REWARD_CATALOG.find((reward) => reward.id === id) ?? DEFAULT_REWARD;
}

export function randomReward(random = Math.random): RewardDefinition {
  const draw = Math.min(Math.max(random(), 0), 0.999999999999);
  return REWARD_CATALOG[Math.floor(draw * REWARD_CATALOG.length)] ?? DEFAULT_REWARD;
}

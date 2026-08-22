import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Award, History, TicketCheck, Trophy, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useRedeemReward } from "@/hooks/use-cleaning-data";
import {
  completionsThisWeek,
  leagueScores,
  personById,
  rescueStats,
  startOfWeek,
  type Completion,
  type Person,
  type PersonId,
  type RewardVoucher,
  type Task,
  type Zone,
} from "@/lib/cleaning";
import { cn } from "@/lib/utils";

import { HistoryList } from "./HistoryList";

export function ProfileView({
  currentPerson,
  people,
  rewards,
  completions,
  tasks,
  zones,
  onUndo,
  section,
  onSectionChange,
}: {
  currentPerson: PersonId;
  people: Person[];
  rewards: RewardVoucher[];
  completions: Completion[];
  tasks: Task[];
  zones: Zone[];
  onUndo: (id: string) => void;
  section: "rewards" | "history";
  onSectionChange: (section: "rewards" | "history") => void;
}) {
  const [pendingReward, setPendingReward] = useState<RewardVoucher | null>(null);
  const redeem = useRedeemReward();
  const scores = leagueScores(completions, tasks, startOfWeek());
  const rescues = rescueStats(completions, tasks, startOfWeek());
  const weekRows = completionsThisWeek(completions);
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <section className="space-y-4">
      <div className="animate-rise-in">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Vuestra casa
        </p>
        <h2 className="mt-1 text-3xl font-semibold">Perfiles y vales</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El progreso es personal; los premios y canjes son visibles para los dos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {people.map((person) => {
          const available = rewards.filter(
            (reward) => reward.earnedBy === person.id && !reward.redeemedAt,
          ).length;
          const zonesCount = new Set(
            weekRows
              .filter((row) => row.personId === person.id)
              .map((row) => tasksById.get(row.taskId)?.zoneId)
              .filter(Boolean),
          ).size;
          return (
            <article
              key={person.id}
              className={cn(
                "card-soft rounded-3xl p-4",
                person.id === currentPerson
                  ? person.id === "lucy"
                    ? "border-lucy/35 bg-lucy-soft/35"
                    : "border-manu/35 bg-manu-soft/35"
                  : "opacity-85",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl">{person.emoji}</span>
                <div>
                  <p className="text-sm font-bold">{person.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.id === currentPerson ? "Este móvil" : "La otra mitad"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <ProfileMetric icon={Trophy} value={scores[person.id]} label="Puntos" />
                <ProfileMetric icon={TicketCheck} value={available} label="Vales" />
                <ProfileMetric icon={Award} value={rescues[person.id].rescued} label="Rescates" />
                <ProfileMetric icon={UserRound} value={zonesCount} label="Zonas" />
              </div>
            </article>
          );
        })}
      </div>

      <div className="card-soft grid grid-cols-2 gap-1 rounded-full p-1.5">
        <SectionButton active={section === "rewards"} onClick={() => onSectionChange("rewards")}>
          <TicketCheck className="size-4" /> Vales
        </SectionButton>
        <SectionButton active={section === "history"} onClick={() => onSectionChange("history")}>
          <History className="size-4" /> Registro
        </SectionButton>
      </div>

      {section === "rewards" ? (
        <div className="space-y-5">
          {people.map((person) => {
            const ownRewards = rewards.filter((reward) => reward.earnedBy === person.id);
            return (
              <div key={person.id}>
                <h3 className="mb-3 text-lg font-semibold">
                  {person.emoji} Vales de {person.label}
                </h3>
                {ownRewards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                    Todavía no hay vales. El primero llega al ganar el duelo semanal.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ownRewards.map((reward) => (
                      <article
                        key={reward.id}
                        className={cn(
                          "card-soft rounded-3xl p-4",
                          reward.redeemedAt && "bg-muted/55 opacity-70",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-soon-soft text-2xl">
                            {reward.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">{reward.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Ganado la semana del {formatWeek(reward.weekKey)}
                            </p>
                            {reward.redeemedAt ? (
                              <p className="mt-2 text-xs font-semibold text-fresh">
                                ✓{" "}
                                {reward.rewardId === "skip-next-task" && !reward.consumedAt
                                  ? "Activado: se aplicará al próximo relevo"
                                  : `Canjeado el ${formatDate(reward.redeemedAt)}`}
                              </p>
                            ) : person.id === currentPerson ? (
                              <button
                                type="button"
                                onClick={() => setPendingReward(reward)}
                                className="mt-3 min-h-11 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground"
                              >
                                {reward.rewardId === "skip-next-task"
                                  ? "Activar para la próxima tarea"
                                  : "Canjear este vale"}
                              </button>
                            ) : (
                              <p className="mt-2 text-xs font-semibold text-soon">
                                Disponible para {person.label}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <HistoryList
          completions={completions}
          tasks={tasks}
          zones={zones}
          people={people}
          onUndo={onUndo}
        />
      )}

      <AlertDialog.Root
        open={Boolean(pendingReward)}
        onOpenChange={(open) => !open && setPendingReward(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" />
          <AlertDialog.Content className="card-soft fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-3xl p-5 shadow-2xl">
            <AlertDialog.Title className="text-2xl font-semibold">
              ¿Canjear este vale?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              {pendingReward?.emoji} {pendingReward?.title}. El canje será visible para Lucy y Manu.
            </AlertDialog.Description>
            <div className="mt-5 flex gap-2">
              <AlertDialog.Cancel className="min-h-11 flex-1 rounded-xl bg-secondary px-4 text-sm font-semibold">
                Todavía no
              </AlertDialog.Cancel>
              <AlertDialog.Action
                className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                onClick={() => {
                  if (!pendingReward) return;
                  redeem.mutate(
                    { id: pendingReward.id, personId: currentPerson },
                    {
                      onSuccess: () => toast.success("Vale canjeado. Que se cumpla ✨"),
                      onError: () => toast.error("No se ha podido canjear el vale"),
                    },
                  );
                  setPendingReward(null);
                }}
              >
                Sí, canjear
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

function ProfileMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Trophy;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-card/75 px-2 py-2">
      <Icon className="mx-auto size-4 text-primary" />
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-center gap-2 rounded-full text-xs font-semibold",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function formatWeek(weekKey: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(
    new Date(`${weekKey}T12:00:00Z`),
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(iso));
}

import { BarChart3, Map as MapIcon } from "lucide-react";
import { useMemo, useState } from "react";

import {
  leagueScores,
  startOfWeek,
  type Completion,
  type LeagueScores,
  type Person,
  type PersonId,
  type Task,
  type Zone,
} from "@/lib/cleaning";
import { cn } from "@/lib/utils";

const WEEKS_SHOWN = 8;
const ZONE_WINDOW_DAYS = 30;
const SERIES: { id: PersonId; token: string }[] = [
  { id: "lucy", token: "var(--chart-lucy)" },
  { id: "manu", token: "var(--chart-manu)" },
];

interface WeekPoint {
  label: string;
  scores: LeagueScores;
  current: boolean;
}

export function StatsSection({
  completions,
  tasks,
  zones,
  people,
}: {
  completions: Completion[];
  tasks: Task[];
  zones: Zone[];
  people: Person[];
}) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const weeks = useMemo(() => weeklyTrend(completions, tasks), [completions, tasks]);
  const zoneSplit = useMemo(
    () => zoneActivity(completions, tasks, zones),
    [completions, tasks, zones],
  );
  const hasTrendData = weeks.some((week) => week.scores.lucy > 0 || week.scores.manu > 0);

  return (
    <>
      <div className="animate-rise-in card-soft rounded-3xl p-5">
        <CardTitle icon={BarChart3}>Tendencia · últimas {WEEKS_SHOWN} semanas</CardTitle>
        <Legend peopleById={peopleById} />
        {hasTrendData ? (
          <TrendChart weeks={weeks} peopleById={peopleById} />
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Cuando llevéis unas semanas de liga, aquí se verá quién aprieta.
          </p>
        )}
      </div>

      <div className="animate-rise-in card-soft rounded-3xl p-5">
        <CardTitle icon={MapIcon}>Zonas · últimos {ZONE_WINDOW_DAYS} días</CardTitle>
        <Legend peopleById={peopleById} />
        {zoneSplit.length > 0 ? (
          <div className="mt-4 space-y-3">
            {zoneSplit.map((row) => (
              <ZoneBar key={row.zone.id} row={row} peopleById={peopleById} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Todavía no hay actividad registrada en este periodo.
          </p>
        )}
      </div>
    </>
  );
}

function weeklyTrend(completions: Completion[], tasks: Task[]): WeekPoint[] {
  const currentStart = startOfWeek();
  const weeks: WeekPoint[] = [];
  for (let i = WEEKS_SHOWN - 1; i >= 0; i -= 1) {
    const since = new Date(currentStart.getTime() - i * 7 * 24 * 60 * 60 * 1_000);
    const until = new Date(since.getTime() + 7 * 24 * 60 * 60 * 1_000);
    weeks.push({
      label: since.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
      scores: leagueScores(completions, tasks, since, until),
      current: i === 0,
    });
  }
  return weeks;
}

interface ZoneRow {
  zone: Zone;
  counts: LeagueScores;
  total: number;
}

function zoneActivity(completions: Completion[], tasks: Task[], zones: Zone[]): ZoneRow[] {
  const since = Date.now() - ZONE_WINDOW_DAYS * 24 * 60 * 60 * 1_000;
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const counts = new Map<string, LeagueScores>();
  for (const completion of completions) {
    if (completion.undoneAt || completion.skipped) continue;
    if (new Date(completion.completedAt).getTime() < since) continue;
    const zoneId = tasksById.get(completion.taskId)?.zoneId;
    if (!zoneId) continue;
    const row = counts.get(zoneId) ?? { lucy: 0, manu: 0 };
    row[completion.personId] += 1;
    counts.set(zoneId, row);
  }
  return zones
    .map((zone) => {
      const row = counts.get(zone.id) ?? { lucy: 0, manu: 0 };
      return { zone, counts: row, total: row.lucy + row.manu };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 150;
const PLOT_HEIGHT = 118;
const BAR_GAP = 2;

function TrendChart({
  weeks,
  peopleById,
}: {
  weeks: WeekPoint[];
  peopleById: Map<PersonId, Person>;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.flatMap((week) => [week.scores.lucy, week.scores.manu]));
  const groupWidth = CHART_WIDTH / weeks.length;
  const barWidth = Math.min(22, (groupWidth - 24) / 2);
  const hovered = hover === null ? null : weeks[hover];

  return (
    <div className="relative mt-4">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Puntos por semana de ${peopleById.get("lucy")?.label} y ${peopleById.get("manu")?.label}`}
      >
        {weeks.map((week, index) => {
          const groupX = index * groupWidth + groupWidth / 2;
          return (
            <g key={week.label}>
              {/* Zona de hover más generosa que las propias barras */}
              <rect
                x={index * groupWidth}
                y={0}
                width={groupWidth}
                height={CHART_HEIGHT}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === index ? null : index)}
              />
              {SERIES.map(({ id, token }, seriesIndex) => {
                const value = week.scores[id];
                const height = Math.round((value / max) * (PLOT_HEIGHT - 8));
                const x =
                  seriesIndex === 0 ? groupX - barWidth - BAR_GAP / 2 : groupX + BAR_GAP / 2;
                const y = PLOT_HEIGHT - height;
                return (
                  <g key={id} pointerEvents="none">
                    {value > 0 ? (
                      <path d={topRoundedBar(x, y, barWidth, height)} fill={token} />
                    ) : (
                      <rect
                        x={x}
                        y={PLOT_HEIGHT - 2}
                        width={barWidth}
                        height={2}
                        fill={token}
                        opacity={0.45}
                      />
                    )}
                    {week.current && value > 0 ? (
                      <text
                        x={x + barWidth / 2}
                        y={y - 5}
                        textAnchor="middle"
                        className="fill-foreground"
                        fontSize={13}
                        fontWeight={700}
                      >
                        {value}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              <text
                x={groupX}
                y={CHART_HEIGHT - 12}
                textAnchor="middle"
                className={cn(week.current ? "fill-foreground" : "fill-muted-foreground")}
                fontSize={12}
                fontWeight={week.current ? 700 : 500}
              >
                {week.label}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          x2={CHART_WIDTH}
          y1={PLOT_HEIGHT}
          y2={PLOT_HEIGHT}
          stroke="var(--border)"
          strokeWidth={1}
        />
      </svg>
      {hovered && hover !== null ? (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-xl border border-border bg-popover px-3 py-1.5 text-xs shadow-md"
          style={{ left: `${((hover + 0.5) / weeks.length) * 100}%` }}
        >
          <p className="font-semibold">Semana del {hovered.label}</p>
          {SERIES.map(({ id, token }) => (
            <p key={id} className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2 rounded-full" style={{ background: token }} />
              {peopleById.get(id)?.label}: {hovered.scores[id]}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function topRoundedBar(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, height, width / 2);
  return [
    `M ${x} ${y + height}`,
    `V ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `H ${x + width - radius}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `V ${y + height}`,
    "Z",
  ].join(" ");
}

function ZoneBar({ row, peopleById }: { row: ZoneRow; peopleById: Map<PersonId, Person> }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold">{row.zone.label}</span>
        <span className="text-muted-foreground">
          {row.total} {row.total === 1 ? "tarea" : "tareas"}
        </span>
      </div>
      <div
        className="mt-1.5 flex h-3.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${row.zone.label}: ${peopleById.get("lucy")?.label} ${row.counts.lucy}, ${peopleById.get("manu")?.label} ${row.counts.manu}`}
      >
        {SERIES.filter(({ id }) => row.counts[id] > 0).map(({ id, token }, index) => (
          <span
            key={id}
            title={`${peopleById.get(id)?.label}: ${row.counts[id]}`}
            className={cn("h-full rounded-full", index > 0 && "ml-0.5")}
            style={{ width: `${(row.counts[id] / row.total) * 100}%`, background: token }}
          />
        ))}
      </div>
    </div>
  );
}

function Legend({ peopleById }: { peopleById: Map<PersonId, Person> }) {
  return (
    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
      {SERIES.map(({ id, token }) => (
        <span key={id} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: token }} />
          {peopleById.get(id)?.emoji} {peopleById.get(id)?.label}
        </span>
      ))}
    </div>
  );
}

function CardTitle({
  icon: Icon,
  children,
}: {
  icon: typeof BarChart3;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold">
      <Icon className="size-4 text-primary" />
      {children}
    </h3>
  );
}

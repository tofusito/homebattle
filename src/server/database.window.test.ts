import { describe, expect, test } from "bun:test";

import { startOfWeek } from "@/lib/cleaning";
import { HISTORY_WINDOW_DAYS, historyWindowStart } from "@/server/database.server";

describe("historyWindowStart", () => {
  test("recorta exactamente la ventana configurada", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const start = historyWindowStart(now);
    const days = (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1_000);
    expect(days).toBe(HISTORY_WINDOW_DAYS);
  });

  test("siempre cubre la semana de liga en curso", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    expect(historyWindowStart(now).getTime()).toBeLessThan(startOfWeek(now).getTime());
  });

  test("cubre el ciclo más largo de tareas (mensual) con margen", () => {
    expect(HISTORY_WINDOW_DAYS).toBeGreaterThanOrEqual(62);
  });
});

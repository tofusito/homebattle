/**
 * Tests de integración contra un MongoDB real.
 *
 * Se activan con INTEGRATION_TESTS=1 y usan una base de datos dedicada
 * (happy_home_test) con el usuario root del contenedor de pruebas, para no
 * tocar nunca la base de desarrollo. En CI corre contra el service de mongo.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";

const RUN = process.env["INTEGRATION_TESTS"] === "1";
const suite = RUN ? describe : describe.skip;

const TEST_ENV = {
  MONGODB_HOST: process.env["MONGODB_TEST_HOST"] ?? "127.0.0.1",
  MONGODB_PORT: process.env["MONGODB_TEST_PORT"] ?? "27017",
  MONGODB_DATABASE: "happy_home_test",
  MONGODB_USERNAME: process.env["MONGODB_TEST_USERNAME"] ?? "root",
  MONGODB_PASSWORD: process.env["MONGODB_TEST_PASSWORD"] ?? "root",
  MONGODB_AUTH_SOURCE: process.env["MONGODB_TEST_AUTH_SOURCE"] ?? "admin",
};

suite("database.server (integración)", () => {
  let db: typeof import("@/server/database.server");

  beforeAll(async () => {
    Object.assign(process.env, TEST_ENV);
    const admin = await new MongoClient(
      `mongodb://${TEST_ENV.MONGODB_USERNAME}:${TEST_ENV.MONGODB_PASSWORD}@${TEST_ENV.MONGODB_HOST}:${TEST_ENV.MONGODB_PORT}/?authSource=${TEST_ENV.MONGODB_AUTH_SOURCE}`,
    ).connect();
    await admin.db(TEST_ENV.MONGODB_DATABASE).dropDatabase();
    await admin.close();
    // Importar tras fijar el entorno: el módulo lee las variables al conectar.
    db = await import("@/server/database.server");
  });

  afterAll(async () => {
    await db?.closeDatabase();
  });

  test("siembra y devuelve el estado inicial", async () => {
    const data = await db.readCleaningData();
    expect(data.people.map((person) => person.id).sort()).toEqual(["lucy", "manu"]);
    expect(data.tasks.length).toBeGreaterThan(0);
    expect(data.zones.length).toBeGreaterThan(0);
    expect(data.settings.weeklyRewardId).toBeTruthy();
  });

  test("la caché de payload sirve la segunda lectura y se invalida", async () => {
    db.invalidateCleaningCache();
    const first = await db.readCleaningData();
    const second = await db.readCleaningData();
    expect(second).toBe(first);
    db.invalidateCleaningCache();
    const third = await db.readCleaningData();
    expect(third).not.toBe(first);
  });

  test("addCompletion es idempotente por id", async () => {
    const id = crypto.randomUUID();
    const task = (await db.readCleaningData()).tasks.find(
      (row) => row.schedule.type === "on_demand",
    )!;
    const input = {
      id,
      taskId: task.id,
      personId: "manu" as const,
      completedAt: new Date().toISOString(),
    };
    await db.addCompletion(input);
    await db.addCompletion(input);
    db.invalidateCleaningCache();
    const data = await db.readCleaningData();
    expect(data.completions.filter((row) => row.id === id)).toHaveLength(1);
  });

  test("undoCompletion la saca del estado visible", async () => {
    const id = crypto.randomUUID();
    const task = (await db.readCleaningData()).tasks.find(
      (row) => row.schedule.type === "on_demand",
    )!;
    await db.addCompletion({
      id,
      taskId: task.id,
      personId: "lucy",
      completedAt: new Date().toISOString(),
    });
    await db.undoCompletion(id);
    db.invalidateCleaningCache();
    const data = await db.readCleaningData();
    const stored = data.completions.find((row) => row.id === id);
    expect(stored?.undoneAt).toBeTruthy();
  });

  test("solo comida y cena admiten skip", async () => {
    const task = (await db.readCleaningData()).tasks.find(
      (row) => row.schedule.type === "on_demand",
    )!;
    await expect(
      db.addCompletion({
        id: crypto.randomUUID(),
        taskId: task.id,
        personId: "manu",
        completedAt: new Date().toISOString(),
        skipped: true,
      }),
    ).rejects.toThrow("Only lunch and dinner can be skipped");
  });

  test("editCompletion rechaza fechas futuras", async () => {
    const id = crypto.randomUUID();
    const task = (await db.readCleaningData()).tasks.find(
      (row) => row.schedule.type === "on_demand",
    )!;
    await db.addCompletion({
      id,
      taskId: task.id,
      personId: "manu",
      completedAt: new Date().toISOString(),
    });
    await expect(
      db.editCompletion({
        id,
        personId: "manu",
        completedAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      }),
    ).rejects.toThrow("future");
  });
});

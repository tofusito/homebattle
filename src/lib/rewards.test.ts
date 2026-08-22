import { describe, expect, test } from "bun:test";

import { randomReward, REWARD_CATALOG } from "./rewards";

describe("weekly reward rotation", () => {
  test("draws uniformly from the complete catalog", () => {
    REWARD_CATALOG.forEach((reward, index) => {
      expect(randomReward(() => (index + 0.5) / REWARD_CATALOG.length)).toBe(reward);
    });
  });

  test("can draw the same reward twice", () => {
    expect(randomReward(() => 0.42)).toBe(randomReward(() => 0.42));
  });
});

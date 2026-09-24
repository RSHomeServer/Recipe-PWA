import { describe, expect, it } from "vitest";
import { createMemoryRepositories } from "@/data";
import { createId } from "@/domain";
import { appendPlannedMeal } from "@/features/plan/appendPlannedMeal";

describe("appendPlannedMeal", () => {
  it("appends after existing rows in the same date/slot", async () => {
    const repos = createMemoryRepositories();
    const dinner = createId();
    const lunch = createId();
    const first = await appendPlannedMeal(repos, {
      date: "2026-09-24",
      slotId: dinner,
      entry: {
        kind: "ingredient",
        ingredientId: createId(),
        quantity: { value: 100, unit: "g" },
      },
    });
    const second = await appendPlannedMeal(repos, {
      date: "2026-09-24",
      slotId: dinner,
      entry: {
        kind: "ingredient",
        ingredientId: createId(),
        quantity: { value: 50, unit: "g" },
      },
    });
    const otherSlot = await appendPlannedMeal(repos, {
      date: "2026-09-24",
      slotId: lunch,
      entry: {
        kind: "ingredient",
        ingredientId: createId(),
        quantity: { value: 10, unit: "g" },
      },
    });

    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
    expect(otherSlot.position).toBe(0);
    expect(second.group).toBeNull();
  });
});

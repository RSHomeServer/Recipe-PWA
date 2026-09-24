import { describe, expect, it } from "vitest";
import { PlannedMealSchema, type PlannedMeal } from "@/domain";
import { movePlannedMeal } from "./reorder";

const slotA = "22222222-2222-4222-8222-222222222201";
const slotB = "22222222-2222-4222-8222-222222222202";

function meal(
  id: string,
  date: string,
  slotId: string,
  position: number,
): PlannedMeal {
  return PlannedMealSchema.parse({
    id,
    date,
    slotId,
    position,
    note: null,
    group: null,
    entry: {
      kind: "ingredient",
      ingredientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      quantity: { value: 1, unit: "g" },
    },
  });
}

describe("movePlannedMeal", () => {
  it("reorders within the same slot", () => {
    const all = [
      meal("11111111-1111-4111-8111-111111111111", "2026-09-22", slotA, 0),
      meal("22222222-2222-4222-8222-222222222221", "2026-09-22", slotA, 1),
      meal("33333333-3333-4333-8333-333333333331", "2026-09-22", slotA, 2),
    ];
    const updates = movePlannedMeal(
      all,
      "33333333-3333-4333-8333-333333333331",
      "2026-09-22",
      slotA,
      0,
    );
    const byId = new Map(updates.map((u) => [u.id, u]));
    expect(byId.get("33333333-3333-4333-8333-333333333331")?.position).toBe(0);
    expect(byId.get("11111111-1111-4111-8111-111111111111")?.position).toBe(1);
    expect(byId.get("22222222-2222-4222-8222-222222222221")?.position).toBe(2);
  });

  it("moves across slots and densifies both sides", () => {
    const all = [
      meal("11111111-1111-4111-8111-111111111111", "2026-09-22", slotA, 0),
      meal("22222222-2222-4222-8222-222222222221", "2026-09-22", slotA, 1),
      meal("33333333-3333-4333-8333-333333333331", "2026-09-22", slotB, 0),
    ];
    const updates = movePlannedMeal(
      all,
      "11111111-1111-4111-8111-111111111111",
      "2026-09-23",
      slotB,
      1,
    );
    const moved = updates.find((u) => u.id === "11111111-1111-4111-8111-111111111111");
    // Target day/slot is empty, so index 1 clamps to 0.
    expect(moved).toMatchObject({
      date: "2026-09-23",
      slotId: slotB,
      position: 0,
    });
    const remaining = updates.find(
      (u) => u.id === "22222222-2222-4222-8222-222222222221",
    );
    expect(remaining?.position).toBe(0);
  });
});

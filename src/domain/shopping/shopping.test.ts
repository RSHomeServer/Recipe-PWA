import { describe, expect, it } from "vitest";
import type { PantryStock } from "../pantry/schemas";
import type { PlanRequirementLine } from "../planning/requirements";
import {
  carryOverChecked,
  defaultShoppingWindow,
  emptyShoppingOverlay,
  shoppingList,
  shoppingPreset,
  shiftShoppingWindow,
  windowKey,
  withAdjustment,
  withChecked,
  withManualLine,
  withSuppressed,
} from "./index";

const chickenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const riceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sauceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function req(
  ingredientId: string,
  amount: number,
  kind: "mass" | "volume" | "count" = "mass",
): PlanRequirementLine {
  return {
    ingredientId,
    quantity: { amount, kind },
    sources: [
      {
        recipeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        date: "2026-09-22",
        amount: { amount, kind },
      },
    ],
  };
}

describe("shopping window", () => {
  it("defaults to today through today+6", () => {
    const now = new Date(2026, 8, 23, 12, 0, 0); // local Sep 23
    const w = defaultShoppingWindow(now);
    expect(w).toEqual({ from: "2026-09-23", to: "2026-09-29" });
    expect(windowKey(w)).toBe("2026-09-23_2026-09-29");
  });

  it("supports 7 and 14 day presets and week nudges", () => {
    const now = new Date(2026, 8, 23, 12, 0, 0);
    expect(shoppingPreset(14, now)).toEqual({
      from: "2026-09-23",
      to: "2026-10-06",
    });
    const w = shoppingPreset(7, now);
    expect(shiftShoppingWindow(w, 7)).toEqual({
      from: "2026-09-30",
      to: "2026-10-06",
    });
  });
});

describe("shoppingList", () => {
  it("aggregates then subtracts pantry (decision 18 worked example)", () => {
    // Required: chicken 2.5kg, rice 1.2kg, sauce 600g
    // Pantry: chicken 1.2kg, rice 800g, sauce 300g
    // Shopping: chicken 1.3kg, rice 400g, sauce 300g
    const requirements: PlanRequirementLine[] = [
      req(chickenId, 2500),
      req(riceId, 1200),
      req(sauceId, 600),
    ];
    const pantry: PantryStock[] = [
      {
        ingredientId: chickenId,
        quantity: { amount: 1200, kind: "mass" },
        updatedAt: "2026-09-22T12:00:00.000Z",
      },
      {
        ingredientId: riceId,
        quantity: { amount: 800, kind: "mass" },
        updatedAt: "2026-09-22T12:00:00.000Z",
      },
      {
        ingredientId: sauceId,
        quantity: { amount: 300, kind: "mass" },
        updatedAt: "2026-09-22T12:00:00.000Z",
      },
    ];

    const lines = shoppingList(requirements, pantry, null);
    expect(lines.map((l) => ({ id: l.ingredientId, toBuy: l.toBuy.amount }))).toEqual([
      { id: chickenId, toBuy: 1300 },
      { id: riceId, toBuy: 400 },
      { id: sauceId, toBuy: 300 },
    ]);
  });

  it("floors toBuy at zero and drops covered lines", () => {
    const lines = shoppingList(
      [req(chickenId, 500)],
      [
        {
          ingredientId: chickenId,
          quantity: { amount: 800, kind: "mass" },
          updatedAt: "2026-09-22T12:00:00.000Z",
        },
      ],
      null,
    );
    expect(lines).toEqual([]);
  });

  it("suppresses lines and adds manual entries", () => {
    let overlay = emptyShoppingOverlay("2026-09-23_2026-09-29");
    overlay = withSuppressed(overlay, chickenId, true);
    overlay = withManualLine(overlay, riceId, { amount: 250, kind: "mass" });

    const lines = shoppingList(
      [req(chickenId, 1000), req(sauceId, 100)],
      [],
      overlay,
    );
    expect(lines.map((l) => l.ingredientId)).toEqual([riceId, sauceId]);
    expect(lines.find((l) => l.ingredientId === riceId)?.isManual).toBe(true);
  });

  it("keeps calculated toBuy visible when adjustment differs (decision 19)", () => {
    let overlay = emptyShoppingOverlay("2026-09-23_2026-09-29");
    overlay = withAdjustment(overlay, chickenId, {
      amount: 1500,
      kind: "mass",
    });

    const lines = shoppingList(
      [req(chickenId, 2500)],
      [
        {
          ingredientId: chickenId,
          quantity: { amount: 1200, kind: "mass" },
          updatedAt: "2026-09-22T12:00:00.000Z",
        },
      ],
      overlay,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.toBuy.amount).toBe(1300);
    expect(lines[0]!.buyQuantity.amount).toBe(1500);
    expect(lines[0]!.hasAdjustment).toBe(true);
  });

  it("scopes checked state to the overlay windowKey", () => {
    const keyA = "2026-09-23_2026-09-29";
    const keyB = "2026-09-30_2026-10-06";
    let overlayA = emptyShoppingOverlay(keyA);
    overlayA = withChecked(overlayA, chickenId, true);
    const overlayB = emptyShoppingOverlay(keyB);

    const reqs = [req(chickenId, 500)];
    expect(shoppingList(reqs, [], overlayA)[0]!.checked).toBe(true);
    expect(shoppingList(reqs, [], overlayB)[0]!.checked).toBe(false);
    expect(overlayA.windowKey).not.toBe(overlayB.windowKey);
  });

  it("carryOverChecked merges ticks without rewriting the source overlay", () => {
    let from = emptyShoppingOverlay("a");
    from = withChecked(from, chickenId, true);
    from = withChecked(from, riceId, true);
    let to = emptyShoppingOverlay("b");
    to = withChecked(to, sauceId, true);
    const merged = carryOverChecked(from, to);
    expect(merged.checked.sort()).toEqual(
      [chickenId, riceId, sauceId].sort(),
    );
    expect(from.checked).toEqual([chickenId, riceId]);
  });
});

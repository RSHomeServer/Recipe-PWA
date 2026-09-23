import { describe, expect, it } from "vitest";
import type { Batch } from "../batches/schemas";
import { portionsRemaining } from "../batches/portions";
import type { Ingredient } from "../ingredients/schemas";
import type { PlannedMeal } from "../planning/schemas";
import type { Recipe } from "../recipes/schemas";
import {
  applyPantryOnLogCreate,
  applyPantryOnLogReverse,
  entryNutrition,
  logFromPlan,
  pantrySideEffectForEntry,
  type LoggedMeal,
} from "./index";

const now = "2026-09-23T12:00:00.000Z";

const chicken: Ingredient = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Chicken",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6 },
  notes: null,
  archivedAt: null,
};

const recipe: Recipe = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Chicken bowl",
  servings: 2,
  lines: [
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ingredientId: chicken.id,
      quantity: { amount: 500, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    },
  ],
  steps: ["Cook"],
  tags: [],
  imageId: null,
  notes: null,
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const batch: Batch = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  recipeId: recipe.id,
  scale: 1,
  portionsNominal: 4,
  cookedAt: now,
  label: null,
  closedAt: null,
  notes: null,
  snapshot: {
    recipeName: recipe.name,
    lines: [
      {
        ingredientId: chicken.id,
        ingredientName: chicken.name,
        quantity: { amount: 500, kind: "mass" },
        nutrition: { kcal: 600, proteinG: 115, carbsG: 0, fatG: 13 },
      },
    ],
    total: { kcal: 600, proteinG: 115, carbsG: 0, fatG: 13 },
  },
};

const ctx = {
  recipesById: new Map([[recipe.id, recipe]]),
  batchesById: new Map([[batch.id, batch]]),
  ingredientsById: new Map([[chicken.id, chicken]]),
};

describe("entryNutrition", () => {
  it("scales live recipe totals for recipeServings", () => {
    const result = entryNutrition(
      { kind: "recipeServings", recipeId: recipe.id, servings: 1 },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 500g chicken @ 120 kcal/100g = 600 kcal for 2 servings → 300 per serving
    expect(result.nutrition.kcal).toBe(300);
  });

  it("reads batch snapshot for batchPortions", () => {
    const result = entryNutrition(
      { kind: "batchPortions", batchId: batch.id, portions: 1 },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nutrition.kcal).toBe(150);
  });

  it("uses ingredient nutrition for bare ingredient", () => {
    const result = entryNutrition(
      {
        kind: "ingredient",
        ingredientId: chicken.id,
        quantity: { value: 100, unit: "g" },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nutrition.kcal).toBe(120);
  });

  it("scales customFood by quantity multiplier", () => {
    const result = entryNutrition(
      {
        kind: "customFood",
        food: {
          name: "Wrap",
          quantity: 2,
          nutrition: { kcal: 250, proteinG: 10, carbsG: 30, fatG: 8 },
        },
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nutrition.kcal).toBe(500);
  });
});

describe("logFromPlan", () => {
  it("copies entry and sets plannedMealId without changing plan fields", () => {
    const planned: PlannedMeal = {
      id: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-23",
      slotId: "22222222-2222-4222-8222-222222222222",
      entry: { kind: "recipeServings", recipeId: recipe.id, servings: 1 },
      position: 0,
      note: "lunch",
    };
    const logged = logFromPlan(planned, {
      id: "33333333-3333-4333-8333-333333333333",
      loggedAt: now,
      entry: { kind: "recipeServings", recipeId: recipe.id, servings: 1.5 },
    });
    expect(logged.plannedMealId).toBe(planned.id);
    expect(logged.entry).toEqual({
      kind: "recipeServings",
      recipeId: recipe.id,
      servings: 1.5,
    });
    expect(logged.date).toBe(planned.date);
    expect(logged.slotId).toBe(planned.slotId);
    expect(planned.entry).toEqual({
      kind: "recipeServings",
      recipeId: recipe.id,
      servings: 1,
    });
  });
});

describe("pantry side effects", () => {
  it("deducts pantry for ingredient logs and reverses on delete", () => {
    const entry = {
      kind: "ingredient" as const,
      ingredientId: chicken.id,
      quantity: { value: 200, unit: "g" as const },
    };
    const effect = pantrySideEffectForEntry(entry);
    expect(effect.kind).toBe("ingredient");

    const existing = {
      ingredientId: chicken.id,
      quantity: { amount: 1000, kind: "mass" as const },
      updatedAt: now,
    };
    const afterCreate = applyPantryOnLogCreate(
      effect,
      existing,
      chicken,
      now,
    );
    expect(afterCreate.ok).toBe(true);
    if (!afterCreate.ok || !afterCreate.stock) return;
    expect(afterCreate.stock.quantity.amount).toBe(800);

    const afterDelete = applyPantryOnLogReverse(
      effect,
      afterCreate.stock,
      chicken,
      now,
    );
    expect(afterDelete.ok).toBe(true);
    if (!afterDelete.ok || !afterDelete.stock) return;
    expect(afterDelete.stock.quantity.amount).toBe(1000);
  });

  it("does not touch pantry for batchPortions; remaining is derived from logs", () => {
    const entry = {
      kind: "batchPortions" as const,
      batchId: batch.id,
      portions: 1.5,
    };
    expect(pantrySideEffectForEntry(entry)).toEqual({ kind: "none" });

    const log: LoggedMeal = {
      id: "44444444-4444-4444-8444-444444444444",
      date: "2026-09-23",
      slotId: "22222222-2222-4222-8222-222222222222",
      entry,
      plannedMealId: null,
      loggedAt: now,
      note: null,
    };
    expect(portionsRemaining(batch, [log])).toBe(2.5);
  });

  it("does not touch pantry for recipeServings or customFood", () => {
    expect(
      pantrySideEffectForEntry({
        kind: "recipeServings",
        recipeId: recipe.id,
        servings: 1,
      }),
    ).toEqual({ kind: "none" });
    expect(
      pantrySideEffectForEntry({
        kind: "customFood",
        food: {
          name: "Bar",
          quantity: 1,
          nutrition: { kcal: 100, proteinG: 1, carbsG: 1, fatG: 1 },
        },
      }),
    ).toEqual({ kind: "none" });
  });
});

import { describe, expect, it } from "vitest";
import type { Batch } from "../batches/schemas";
import type { Ingredient } from "../ingredients/schemas";
import type { Recipe } from "../recipes/schemas";
import type { LoggedMeal } from "../logging/schemas";
import {
  expand,
  expandAll,
  expandCtxFromMaps,
  byDay,
  byMeal,
  byRecipe,
  byIngredient,
  daysWithAnyLog,
  weeklyAverage,
  foldKcalTotal,
  remaining,
  UNATTRIBUTED_KEY,
} from "./index";

const now = "2026-09-23T12:00:00.000Z";

const chicken: Ingredient = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Chicken",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6 },
  notes: null,
  source: {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note: null,
  },
  imageId: null,
  common: true,
  archivedAt: null,
};

const rice: Ingredient = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
  name: "Rice",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
  notes: null,
  source: {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note: null,
  },
  imageId: null,
  common: true,
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
    {
      id: "dddddddd-dddd-4ddd-8ddd-ddddddddddde",
      ingredientId: rice.id,
      quantity: { amount: 300, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    },
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddf",
      ingredientId: rice.id,
      quantity: { amount: 10, kind: "mass" },
      displayUnit: "g",
      optional: true,
      note: "garnish",
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
      {
        ingredientId: rice.id,
        ingredientName: rice.name,
        quantity: { amount: 300, kind: "mass" },
        nutrition: { kcal: 390, proteinG: 8.1, carbsG: 84, fatG: 0.9 },
      },
    ],
    total: { kcal: 990, proteinG: 123.1, carbsG: 84, fatG: 13.9 },
  },
};

function ctx(recipes = [recipe], batches = [batch], ingredients = [chicken, rice]) {
  return expandCtxFromMaps(
    new Map(recipes.map((r) => [r.id, r])),
    new Map(batches.map((b) => [b.id, b])),
    new Map(ingredients.map((i) => [i.id, i])),
  );
}

function log(
  partial: Omit<LoggedMeal, "plannedMealId" | "loggedAt" | "note" | "group"> &
    Partial<Pick<LoggedMeal, "plannedMealId" | "loggedAt" | "note" | "group">>,
): LoggedMeal {
  return {
    plannedMealId: null,
    loggedAt: now,
    note: null,
    group: null,
    ...partial,
  };
}

describe("expand", () => {
  it("attributes live recipe lines scaled to servings eaten (skips optional)", () => {
    const meal = log({
      id: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-22",
      slotId: "slot-lunch",
      entry: { kind: "recipeServings", recipeId: recipe.id, servings: 1 },
    });
    const cs = expand(meal, ctx());
    expect(cs).toHaveLength(2);
    expect(cs.every((c) => c.source.recipeId === recipe.id)).toBe(true);
    expect(cs.every((c) => c.source.batchId === null)).toBe(true);
    // 500g @ 120/100g = 600 for 2 servings → 300 for 1; rice 390/2 = 195
    expect(cs.find((c) => c.ingredientId === chicken.id)?.nutrition.kcal).toBe(
      300,
    );
    expect(cs.find((c) => c.ingredientId === rice.id)?.nutrition.kcal).toBe(195);
  });

  it("attributes batch snapshot lines scaled to portions (no live lookup)", () => {
    const meal = log({
      id: "22222222-2222-4222-8222-222222222222",
      date: "2026-09-22",
      slotId: "slot-dinner",
      entry: { kind: "batchPortions", batchId: batch.id, portions: 1 },
    });
    const cs = expand(meal, ctx());
    expect(cs).toHaveLength(2);
    expect(cs[0]!.source.batchId).toBe(batch.id);
    // 990 / 4 = 247.5
    expect(cs.reduce((s, c) => s + c.nutrition.kcal, 0)).toBeCloseTo(247.5, 10);
  });

  it("attributes a bare ingredient", () => {
    const meal = log({
      id: "33333333-3333-4333-8333-333333333333",
      date: "2026-09-22",
      slotId: "slot-snack",
      entry: {
        kind: "ingredient",
        ingredientId: chicken.id,
        quantity: { value: 100, unit: "g" },
      },
    });
    const cs = expand(meal, ctx());
    expect(cs).toHaveLength(1);
    expect(cs[0]!.nutrition.kcal).toBe(120);
    expect(cs[0]!.source.recipeId).toBeNull();
  });

  it("puts customFood in the unattributed bucket (null ingredientId)", () => {
    const meal = log({
      id: "44444444-4444-4444-8444-444444444444",
      date: "2026-09-23",
      slotId: "slot-lunch",
      entry: {
        kind: "customFood",
        food: {
          name: "Cafe wrap",
          quantity: 2,
          nutrition: { kcal: 250, proteinG: 10, carbsG: 30, fatG: 8 },
        },
      },
    });
    const cs = expand(meal, ctx());
    expect(cs).toHaveLength(1);
    expect(cs[0]!.ingredientId).toBeNull();
    expect(cs[0]!.ingredientName).toBe("Cafe wrap");
    expect(cs[0]!.nutrition.kcal).toBe(500);
  });
});

describe("history immutability (batch snapshot path)", () => {
  it("expand results stay byte-identical after recipe/ingredient edits", () => {
    const meal = log({
      id: "55555555-5555-4555-8555-555555555555",
      date: "2026-09-21",
      slotId: "slot-dinner",
      entry: { kind: "batchPortions", batchId: batch.id, portions: 2 },
    });
    const before = expand(meal, ctx());
    const beforeJson = JSON.stringify(before);

    const editedRecipe: Recipe = {
      ...recipe,
      lines: recipe.lines.map((line) =>
        line.ingredientId === chicken.id
          ? { ...line, quantity: { amount: 900, kind: "mass" } }
          : line,
      ),
    };
    const editedChicken: Ingredient = {
      ...chicken,
      nutrition: { kcal: 999, proteinG: 50, carbsG: 0, fatG: 20 },
    };

    const after = expand(meal, ctx([editedRecipe], [batch], [editedChicken, rice]));
    expect(JSON.stringify(after)).toBe(beforeJson);
  });
});

describe("folds and reconciliation", () => {
  const meals: LoggedMeal[] = [
    log({
      id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      date: "2026-09-21",
      slotId: "slot-breakfast",
      entry: { kind: "recipeServings", recipeId: recipe.id, servings: 1 },
    }),
    log({
      id: "aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa",
      date: "2026-09-22",
      slotId: "slot-lunch",
      entry: { kind: "batchPortions", batchId: batch.id, portions: 1 },
    }),
    log({
      id: "aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa",
      date: "2026-09-22",
      slotId: "slot-dinner",
      entry: {
        kind: "ingredient",
        ingredientId: rice.id,
        quantity: { value: 100, unit: "g" },
      },
    }),
    log({
      id: "aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa",
      date: "2026-09-23",
      slotId: "slot-lunch",
      entry: {
        kind: "customFood",
        food: {
          name: "Takeaway",
          quantity: 1,
          nutrition: { kcal: 800, proteinG: 20, carbsG: 90, fatG: 30 },
        },
      },
    }),
  ];

  it("reconciles Σ byMeal = byRecipe = byIngredient = byDay", () => {
    const cs = expandAll(meals, ctx());
    const day = foldKcalTotal(byDay(cs));
    const meal = foldKcalTotal(byMeal(cs));
    const recipeFold = foldKcalTotal(byRecipe(cs));
    const ingredientFold = foldKcalTotal(byIngredient(cs));
    expect(meal).toBeCloseTo(day, 10);
    expect(recipeFold).toBeCloseTo(day, 10);
    expect(ingredientFold).toBeCloseTo(day, 10);
  });

  it("keeps customFood visible under __unattributed__", () => {
    const cs = expandAll(meals, ctx());
    const ingredients = byIngredient(cs);
    const unattributed = ingredients.find((b) => b.key === UNATTRIBUTED_KEY);
    expect(unattributed?.nutrition.kcal).toBe(800);
  });

  it("weekly average divides by daysWithAnyLog, not 7", () => {
    const cs = expandAll(meals, ctx());
    expect(daysWithAnyLog(cs)).toBe(3);
    const { average, daysWithLogs, total } = weeklyAverage(cs);
    expect(daysWithLogs).toBe(3);
    expect(average.kcal).toBeCloseTo(total.kcal / 3, 10);
    expect(average.kcal).not.toBeCloseTo(total.kcal / 7, 5);
  });
});

describe("remaining", () => {
  it("may be negative when over target", () => {
    expect(remaining(2400, 1840)).toBe(560);
    expect(remaining(2000, 2180)).toBe(-180);
  });
});

import { describe, expect, it } from "vitest";
import type { Ingredient } from "../ingredients/schemas";
import type { Recipe } from "../recipes/schemas";
import { PlannedMealSchema, type PlannedMeal } from "./schemas";
import { requirements } from "./requirements";
import { weekContaining, eachDateInRange, shiftWeek } from "./dates";

const chicken: Ingredient = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Chicken",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6, sodiumMg: null },
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
  gramsPerTsp: null,
  gramsPerTbsp: null,
  flavourTags: [],
  archivedAt: null,
};

const rice: Ingredient = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Rice",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, sodiumMg: null },
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
  gramsPerTsp: null,
  gramsPerTbsp: null,
  flavourTags: [],
  archivedAt: null,
};

const salt: Ingredient = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Salt",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 },
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
  gramsPerTsp: null,
  gramsPerTbsp: null,
  flavourTags: [],
  archivedAt: null,
};

const yoghurt: Ingredient = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Yoghurt",
  categoryId: null,
  measureKind: "volume",
  nutrition: { kcal: 60, proteinG: 4, carbsG: 5, fatG: 3, sodiumMg: null },
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
  gramsPerTsp: null,
  gramsPerTbsp: null,
  flavourTags: [],
  archivedAt: null,
};

const recipe: Recipe = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  name: "Chicken bowl",
  servings: 2,
  lines: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      ingredientId: chicken.id,
      quantity: { amount: 500, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    entryHint: null,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      ingredientId: rice.id,
      quantity: { amount: 300, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    entryHint: null,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      ingredientId: salt.id,
      quantity: { amount: 5, kind: "mass" },
      displayUnit: "g",
      optional: true,
      note: null,
    entryHint: null,
    },
  ],
  steps: ["Cook"],
  tags: [],
  imageId: null,
  notes: null,
  createdAt: "2026-09-22T12:00:00.000Z",
  updatedAt: "2026-09-22T12:00:00.000Z",
  kind: "dish",
  archivedAt: null,
};

const slotId = "22222222-2222-4222-8222-222222222201";
const batchId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const ctx = {
  recipesById: new Map([[recipe.id, recipe]]),
  ingredientsById: new Map<string, Ingredient>([
    [chicken.id, chicken],
    [rice.id, rice],
    [salt.id, salt],
    [yoghurt.id, yoghurt],
  ]),
};

function meal(
  partial: {
    id?: string;
    date: string;
    position?: number;
    entry: PlannedMeal["entry"];
  },
): PlannedMeal {
  return PlannedMealSchema.parse({
    id: partial.id ?? "99999999-9999-4999-8999-999999999901",
    slotId,
    position: partial.position ?? 0,
    note: null,
    group: null,
    date: partial.date,
    entry: partial.entry,
  });
}

describe("requirements", () => {
  it("scales recipeServings by servings ÷ recipe.servings and skips optional lines", () => {
    const meals = [
      meal({
        date: "2026-09-22",
        entry: { kind: "recipeServings", recipeId: recipe.id, servings: 1 },
      }),
    ];
    const lines = requirements(meals, { from: "2026-09-22", to: "2026-09-22" }, ctx);
    expect(lines.map(({ ingredientId, quantity }) => ({ ingredientId, quantity }))).toEqual([
      { ingredientId: chicken.id, quantity: { amount: 250, kind: "mass" } },
      { ingredientId: rice.id, quantity: { amount: 150, kind: "mass" } },
    ]);
    expect(lines.find((l) => l.ingredientId === chicken.id)?.sources).toEqual([
      {
        recipeId: recipe.id,
        date: "2026-09-22",
        amount: { amount: 250, kind: "mass" },
      },
    ]);
  });

  it("aggregates the same recipe across days before any pantry subtraction", () => {
    const meals = ["2026-09-21", "2026-09-22", "2026-09-23"].map((date, i) =>
      meal({
        id: `99999999-9999-4999-8999-99999999990${i + 1}`,
        date,
        entry: { kind: "recipeServings", recipeId: recipe.id, servings: 2 },
        position: i,
      }),
    );
    const lines = requirements(meals, { from: "2026-09-21", to: "2026-09-23" }, ctx);
    expect(lines.find((l) => l.ingredientId === chicken.id)?.quantity.amount).toBe(
      1500,
    );
    expect(lines.find((l) => l.ingredientId === rice.id)?.quantity.amount).toBe(900);
    expect(
      lines.find((l) => l.ingredientId === chicken.id)?.sources,
    ).toHaveLength(3);
  });

  it("batchPortions contribute nothing", () => {
    const meals = [
      meal({
        date: "2026-09-22",
        entry: { kind: "batchPortions", batchId, portions: 1.5 },
      }),
      meal({
        id: "99999999-9999-4999-8999-999999999902",
        date: "2026-09-22",
        entry: {
          kind: "ingredient",
          ingredientId: yoghurt.id,
          quantity: { value: 200, unit: "ml" },
        },
        position: 1,
      }),
    ];
    const lines = requirements(meals, { from: "2026-09-22", to: "2026-09-22" }, ctx);
    expect(lines.map(({ ingredientId, quantity }) => ({ ingredientId, quantity }))).toEqual([
      { ingredientId: yoghurt.id, quantity: { amount: 200, kind: "volume" } },
    ]);
    expect(lines[0]?.sources).toEqual([
      {
        recipeId: null,
        date: "2026-09-22",
        amount: { amount: 200, kind: "volume" },
      },
    ]);
  });

  it("converts ingredient display quantities to canonical units", () => {
    const meals = [
      meal({
        date: "2026-09-22",
        entry: {
          kind: "ingredient",
          ingredientId: chicken.id,
          quantity: { value: 1.2, unit: "kg" },
        },
      }),
    ];
    const lines = requirements(meals, { from: "2026-09-22", to: "2026-09-22" }, ctx);
    expect(lines.map(({ ingredientId, quantity }) => ({ ingredientId, quantity }))).toEqual([
      { ingredientId: chicken.id, quantity: { amount: 1200, kind: "mass" } },
    ]);
  });

  it("ignores meals outside the date range", () => {
    const meals = [
      meal({
        date: "2026-09-20",
        entry: { kind: "recipeServings", recipeId: recipe.id, servings: 2 },
      }),
    ];
    expect(
      requirements(meals, { from: "2026-09-21", to: "2026-09-27" }, ctx),
    ).toEqual([]);
  });
});

describe("week dates", () => {
  it("builds a Monday-start week containing the anchor", () => {
    // 2026-09-23 is a Wednesday
    const week = weekContaining("2026-09-23", 1);
    expect(week).toEqual({ from: "2026-09-21", to: "2026-09-27" });
    expect(eachDateInRange(week)).toHaveLength(7);
    expect(eachDateInRange(week)[0]).toBe("2026-09-21");
    expect(eachDateInRange(week)[6]).toBe("2026-09-27");
  });

  it("shifts a week forward and back", () => {
    const week = weekContaining("2026-09-23", 1);
    expect(shiftWeek(week, 1)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(shiftWeek(week, -1)).toEqual({ from: "2026-09-14", to: "2026-09-20" });
  });
});

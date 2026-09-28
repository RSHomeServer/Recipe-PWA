import { describe, expect, it } from "vitest";
import {
  clearEntryHints,
  entryMeasuresFor,
  entryToCanonical,
  entryUnitsForIngredient,
  formatLineQuantity,
  gramsPerSpoon,
  kcalPerSpoon,
  recipeHasSpoonEntry,
  spoonsToCanonical,
} from "@/domain/spoons";
import {
  IngredientSchema,
  recipeAvailability,
  recipeTotal,
  requirements,
  shoppingList,
  type Ingredient,
  type Recipe,
} from "@/domain";
import { unitsForKind } from "@/domain/units";

const paprikaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const paprika = IngredientSchema.parse({
  id: paprikaId,
  name: "Paprika",
  categoryId: null,
  measureKind: "mass",
  nutrition: {
    kcal: 282,
    proteinG: 14.14,
    carbsG: 53.99,
    fatG: 12.89,
    sodiumMg: 68,
  },
  notes: "Also searchable as: smoked paprika.",
  archivedAt: null,
  source: {
    kind: "reference",
    datasetId: "usda-sr-legacy",
    datasetName: "USDA SR Legacy",
    entryCode: "171329",
    entryName: "Spices, paprika",
    licence: "CC0-1.0",
    url: null,
    retrievedAt: "2018-04-01",
    note: null,
  },
  imageId: null,
  common: true,
  gramsPerTsp: 2.3,
  gramsPerTbsp: 6.8,
  flavourTags: [],
});

const oil = IngredientSchema.parse({
  ...paprika,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Chilli oil",
  notes: null,
  gramsPerTsp: null,
  gramsPerTbsp: null,
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
});

describe("spoon conversion (R3.4–R3.5, R3.7)", () => {
  it("stores 2 tsp at 2.3 g/tsp as 4.6 g mass", () => {
    const result = spoonsToCanonical(2, "tsp", paprika);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.canonical).toEqual({ amount: 4.6, kind: "mass" });
    expect(result.entryHint).toEqual({ spoons: 2, spoon: "tsp" });
  });

  it("omits spoon options when weight is null or not mass", () => {
    expect(entryMeasuresFor(oil)).toEqual(["g", "kg"]);
    expect(entryUnitsForIngredient(oil, unitsForKind)).toEqual(["g", "kg"]);
    expect(entryMeasuresFor(paprika)).toEqual(["g", "kg", "tsp", "tbsp"]);
    expect(
      entryMeasuresFor({ ...paprika, gramsPerTbsp: null }),
    ).toEqual(["g", "kg", "tsp"]);
  });

  it("computes per-spoon kcal at display time", () => {
    expect(kcalPerSpoon(paprika, "tsp")).toBeCloseTo((282 * 2.3) / 100, 6);
    expect(kcalPerSpoon(oil, "tsp")).toBeNull();
  });

  it("formats spoon read-back and approximate flag", () => {
    expect(
      formatLineQuantity({
        quantity: { amount: 4.6, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 2, spoon: "tsp" },
      }),
    ).toBe("2 tsp (4.6 g)");
    expect(
      formatLineQuantity({
        quantity: { amount: 4.6, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      }),
    ).toBe("4.6 g");
    expect(
      recipeHasSpoonEntry([{ entryHint: { spoons: 1, spoon: "tsp" } }]),
    ).toBe(true);
  });

  it("rejects spoon entry without a cited weight", () => {
    const result = entryToCanonical(1, "tsp", oil);
    expect(result.ok).toBe(false);
  });
});

describe("entryHint invariance (R3.6)", () => {
  it("requirements, shopping, availability and nutrition stay byte-identical with entryHint cleared", () => {
    const withHint: Recipe = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Seasoned",
      servings: 1,
      lines: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          ingredientId: paprikaId,
          quantity: { amount: 4.6, kind: "mass" },
          displayUnit: "g",
          optional: false,
          note: null,
          entryHint: { spoons: 2, spoon: "tsp" },
        },
      ],
      steps: [],
      tags: [],
      imageId: null,
      notes: null,
      createdAt: "2026-09-28T00:00:00.000Z",
      updatedAt: "2026-09-28T00:00:00.000Z",
      kind: "dish",
      archivedAt: null,
    };
    const cleared: Recipe = {
      ...withHint,
      lines: clearEntryHints(withHint.lines),
    };

    const byId: Record<string, Ingredient> = { [paprikaId]: paprika };
    const ingredientsById = new Map([[paprikaId, paprika]]);

    expect(recipeTotal(withHint, byId)).toEqual(recipeTotal(cleared, byId));
    expect(
      recipeAvailability(withHint, new Map(), ingredientsById),
    ).toEqual(recipeAvailability(cleared, new Map(), ingredientsById));

    const planned = [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        date: "2026-09-28",
        slotId: "22222222-2222-4222-8222-222222222203",
        entry: {
          kind: "recipeServings" as const,
          recipeId: withHint.id,
          servings: 1,
        },
        position: 0,
        note: null,
        group: null,
      },
    ];
    const range = { from: "2026-09-28", to: "2026-09-28" } as const;
    const ctx = {
      recipesById: new Map([[withHint.id, withHint]]),
      ingredientsById,
    };
    const ctxCleared = {
      recipesById: new Map([[cleared.id, cleared]]),
      ingredientsById,
    };
    const reqA = requirements(planned, range, ctx);
    const reqB = requirements(planned, range, ctxCleared);
    expect(reqA).toEqual(reqB);
    expect(shoppingList(reqA, [], null)).toEqual(shoppingList(reqB, [], null));
    expect(gramsPerSpoon(paprika, "tsp")).toBe(2.3);
  });
});

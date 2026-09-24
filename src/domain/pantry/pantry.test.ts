import { describe, expect, it } from "vitest";
import type { Ingredient } from "../ingredients/schemas";
import type { Recipe } from "../recipes/schemas";
import {
  ALMOST_CAN_MAKE_MAX_MISSING,
  availabilityForAll,
  formatShortfallLabel,
  isNegativeStock,
  recipeAvailability,
} from "./availability";
import type { PantryStock } from "./schemas";
import { addStock, applyStockMutation, removeStock, setStock } from "./stock";

const NOW = "2026-09-22T12:00:00.000Z";

function ingredient(
  overrides: Partial<Ingredient> & Pick<Ingredient, "id" | "name" | "measureKind">,
): Ingredient {
  return {
    categoryId: null,
    nutrition: { kcal: 100, proteinG: 10, carbsG: 10, fatG: 1 },
    notes: null,
    archivedAt: null,
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
    ...overrides,
  };
}

function recipe(
  overrides: Partial<Recipe> & Pick<Recipe, "id" | "name" | "lines">,
): Recipe {
  return {
    servings: 2,
    steps: [],
    tags: [],
    imageId: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    ...overrides,
  };
}

describe("pantry stock mutations", () => {
  const chicken = ingredient({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Chicken",
    measureKind: "mass",
  });
  const milk = ingredient({
    id: "22222222-2222-4222-8222-222222222222",
    name: "Milk",
    measureKind: "volume",
  });

  it("add merges into a single quantity (500 g + 1 kg = 1.5 kg)", () => {
    const first = addStock(undefined, chicken, { value: 500, unit: "g" }, NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = addStock(first.stock, chicken, { value: 1, unit: "kg" }, NOW);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.stock.quantity).toEqual({ amount: 1500, kind: "mass" });
  });

  it("remove subtracts in-family (2 L − 350 ml = 1650 ml)", () => {
    const stock: PantryStock = {
      ingredientId: milk.id,
      quantity: { amount: 2000, kind: "volume" },
      updatedAt: NOW,
    };
    const next = removeStock(stock, milk, { value: 350, unit: "ml" }, NOW);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.stock.quantity).toEqual({ amount: 1650, kind: "volume" });
  });

  it("set replaces the stored quantity", () => {
    const stock: PantryStock = {
      ingredientId: chicken.id,
      quantity: { amount: 500, kind: "mass" },
      updatedAt: NOW,
    };
    const next = setStock(stock, chicken, { value: 1.2, unit: "kg" }, NOW);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect(next.stock.quantity).toEqual({ amount: 1200, kind: "mass" });
  });

  it("keeps a zero row and never clamps negatives", () => {
    const zero = setStock(undefined, chicken, { value: 0, unit: "g" }, NOW);
    expect(zero.ok).toBe(true);
    if (!zero.ok) return;
    expect(zero.stock.quantity.amount).toBe(0);

    const negative = removeStock(
      zero.stock,
      chicken,
      { value: 200, unit: "g" },
      NOW,
    );
    expect(negative.ok).toBe(true);
    if (!negative.ok) return;
    expect(negative.stock.quantity.amount).toBe(-200);
    expect(isNegativeStock(negative.stock.quantity)).toBe(true);
  });

  it("rejects cross-family mutations", () => {
    const result = applyStockMutation(
      undefined,
      chicken,
      { op: "add", quantity: { value: 1, unit: "L" } },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("wrongFamily");
  });
});

describe("recipe availability", () => {
  const onion = ingredient({
    id: "33333333-3333-4333-8333-333333333333",
    name: "Onion",
    measureKind: "mass",
  });
  const rice = ingredient({
    id: "44444444-4444-4444-8444-444444444444",
    name: "Rice",
    measureKind: "mass",
  });
  const oil = ingredient({
    id: "55555555-5555-4555-8555-555555555555",
    name: "Oil",
    measureKind: "volume",
  });
  const salt = ingredient({
    id: "66666666-6666-4666-8666-666666666666",
    name: "Salt",
    measureKind: "mass",
  });

  const ingredientsById = new Map(
    [onion, rice, oil, salt].map((row) => [row.id, row]),
  );

  const curry = recipe({
    id: "77777777-7777-4777-8777-777777777777",
    name: "Curry",
    lines: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ingredientId: onion.id,
        quantity: { amount: 100, kind: "mass" },
        displayUnit: "g",
        optional: false,
        note: null,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        ingredientId: rice.id,
        quantity: { amount: 300, kind: "mass" },
        displayUnit: "g",
        optional: false,
        note: null,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        ingredientId: oil.id,
        quantity: { amount: 20, kind: "volume" },
        displayUnit: "ml",
        optional: false,
        note: null,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        ingredientId: salt.id,
        quantity: { amount: 5, kind: "mass" },
        displayUnit: "g",
        optional: true,
        note: null,
      },
    ],
  });

  it(`classifies canMake / almost (≤${ALMOST_CAN_MAKE_MAX_MISSING}) / missingSignificant`, () => {
    const fullStock = new Map<string, PantryStock>([
      [
        onion.id,
        {
          ingredientId: onion.id,
          quantity: { amount: 100, kind: "mass" },
          updatedAt: NOW,
        },
      ],
      [
        rice.id,
        {
          ingredientId: rice.id,
          quantity: { amount: 300, kind: "mass" },
          updatedAt: NOW,
        },
      ],
      [
        oil.id,
        {
          ingredientId: oil.id,
          quantity: { amount: 20, kind: "volume" },
          updatedAt: NOW,
        },
      ],
    ]);
    expect(recipeAvailability(curry, fullStock, ingredientsById).status).toBe(
      "canMake",
    );

    const oneShort = new Map(fullStock);
    oneShort.set(onion.id, {
      ingredientId: onion.id,
      quantity: { amount: 50, kind: "mass" },
      updatedAt: NOW,
    });
    const almost = recipeAvailability(curry, oneShort, ingredientsById);
    expect(almost.status).toBe("almostCanMake");
    if (almost.status !== "almostCanMake") return;
    expect(almost.shortfalls).toHaveLength(1);
    expect(formatShortfallLabel(almost.shortfalls[0]!, "Onion")).toBe(
      "Onion 50 g",
    );

    const empty = new Map<string, PantryStock>();
    const missing = recipeAvailability(curry, empty, ingredientsById);
    expect(missing.status).toBe("missingSignificant");
    if (missing.status !== "missingSignificant") return;
    // optional salt ignored → 3 required shortfalls
    expect(missing.shortfalls).toHaveLength(3);
  });

  it("availabilityForAll skips archived recipes", () => {
    const archived = recipe({
      id: "88888888-8888-4888-8888-888888888888",
      name: "Old",
      lines: [],
      archivedAt: NOW,
    });
    const results = availabilityForAll(
      [curry, archived],
      [],
      [onion, rice, oil, salt],
    );
    expect(results.map((r) => r.recipeId)).toEqual([curry.id]);
  });
});

import { describe, expect, it } from "vitest";
import {
  IngredientFormSchema,
  IngredientSchema,
  PlannedMealSchema,
  RecipeSchema,
  isIngredientReferenced,
  nutritionBasisLabel,
  type Ingredient,
  type LoggedMeal,
  type PantryStock,
  type PlannedMeal,
  type Recipe,
} from "@/domain";

const ingredientId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const recipeId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const lineId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const mealId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const slotId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function sampleIngredient(): Ingredient {
  return IngredientSchema.parse({
    id: ingredientId,
    name: "Chicken",
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 120, proteinG: 22, carbsG: 0, fatG: 3 },
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
  });
}

describe("nutritionBasisLabel", () => {
  it("matches measure kind bases", () => {
    expect(nutritionBasisLabel("mass")).toBe("per 100 g");
    expect(nutritionBasisLabel("volume")).toBe("per 100 ml");
    expect(nutritionBasisLabel("count")).toBe("per 1 item");
  });
});

describe("IngredientFormSchema", () => {
  it("trims name and empty notes", () => {
    const parsed = IngredientFormSchema.parse({
      name: "  Rice  ",
      categoryId: null,
      measureKind: "mass",
      nutrition: { kcal: 350, proteinG: 7, carbsG: 78, fatG: 1 },
      notes: "   ",
    });
    expect(parsed.name).toBe("Rice");
    expect(parsed.notes).toBeNull();
  });
});

describe("isIngredientReferenced", () => {
  const emptyCtx = {
    recipes: [] as Recipe[],
    pantry: [] as PantryStock[],
    plannedMeals: [] as PlannedMeal[],
    loggedMeals: [] as LoggedMeal[],
  };

  it("is false when unused", () => {
    expect(isIngredientReferenced(ingredientId, emptyCtx)).toBe(false);
  });

  it("detects pantry stock", () => {
    expect(
      isIngredientReferenced(ingredientId, {
        ...emptyCtx,
        pantry: [
          {
            ingredientId,
            quantity: { amount: 500, kind: "mass" },
            updatedAt: "2026-09-22T12:00:00.000Z",
          },
        ],
      }),
    ).toBe(true);
  });

  it("detects recipe lines", () => {
    const recipe = RecipeSchema.parse({
      id: recipeId,
      name: "Curry",
      servings: 2,
      lines: [
        {
          id: lineId,
          ingredientId,
          quantity: { amount: 400, kind: "mass" },
          displayUnit: "g",
          optional: false,
          note: null,
        },
      ],
      steps: [],
      tags: [],
      imageId: null,
      notes: null,
      createdAt: "2026-09-22T12:00:00.000Z",
      updatedAt: "2026-09-22T12:00:00.000Z",
      archivedAt: null,
    });
    expect(
      isIngredientReferenced(ingredientId, {
        ...emptyCtx,
        recipes: [recipe],
      }),
    ).toBe(true);
    expect(isIngredientReferenced(otherId, { ...emptyCtx, recipes: [recipe] })).toBe(
      false,
    );
  });

  it("detects planned and logged ingredient entries", () => {
    const planned = PlannedMealSchema.parse({
      id: mealId,
      date: "2026-09-22",
      slotId,
      entry: {
        kind: "ingredient",
        ingredientId,
        quantity: { value: 100, unit: "g" },
      },
      position: 0,
      note: null,
      group: null,
    });
    expect(
      isIngredientReferenced(ingredientId, {
        ...emptyCtx,
        plannedMeals: [planned],
      }),
    ).toBe(true);

    const logged: LoggedMeal = {
      id: mealId,
      date: "2026-09-22",
      slotId,
      entry: {
        kind: "ingredient",
        ingredientId,
        quantity: { value: 50, unit: "g" },
      },
      plannedMealId: null,
      loggedAt: "2026-09-22T12:00:00.000Z",
      note: null,
      group: null,
    };
    expect(
      isIngredientReferenced(ingredientId, {
        ...emptyCtx,
        loggedMeals: [logged],
      }),
    ).toBe(true);
  });

  it("keeps sample ingredient valid for forms", () => {
    const ingredient = sampleIngredient();
    expect(
      IngredientFormSchema.parse({
        name: ingredient.name,
        categoryId: ingredient.categoryId,
        measureKind: ingredient.measureKind,
        nutrition: ingredient.nutrition,
        notes: "",
      }).name,
    ).toBe("Chicken");
  });
});

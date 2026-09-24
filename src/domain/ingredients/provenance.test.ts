import { describe, expect, it } from "vitest";
import {
  IngredientSchema,
  defaultUserEnteredSource,
  hasDivergedFromReference,
  nutritionOf,
  recipeAvailability,
  recipeTotal,
  requirements,
  shoppingList,
  type Ingredient,
  type IngredientSourceKind,
  type Recipe,
} from "@/domain";
import {
  OriginImmutabilityError,
  prepareIngredientPut,
} from "@/data/repos/snapshot-guard";

const chickenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const riceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseIngredient(
  overrides: Partial<Ingredient> & Pick<Ingredient, "id" | "name">,
): Ingredient {
  return IngredientSchema.parse({
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6 },
    notes: null,
    archivedAt: null,
    source: defaultUserEnteredSource(),
    imageId: null,
    common: true,
    ...overrides,
  });
}

const chicken = baseIngredient({
  id: chickenId,
  name: "Chicken",
  nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6 },
});

const rice = baseIngredient({
  id: riceId,
  name: "Rice",
  nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
});

const recipe: Recipe = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Bowl",
  servings: 2,
  lines: [
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ingredientId: chickenId,
      quantity: { amount: 500, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    },
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      ingredientId: riceId,
      quantity: { amount: 300, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    },
  ],
  steps: [],
  tags: [],
  imageId: null,
  notes: null,
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z",
  archivedAt: null,
};

const kinds: IngredientSourceKind[] = [
  "reference",
  "packaging",
  "userEntered",
  "estimated",
];

function deriveBundle(ingredients: Ingredient[]) {
  const byId = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
  const stockByIngredientId = new Map([
    [
      chickenId,
      {
        ingredientId: chickenId,
        quantity: { amount: 1000, kind: "mass" as const },
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
    ],
    [
      riceId,
      {
        ingredientId: riceId,
        quantity: { amount: 500, kind: "mass" as const },
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
    ],
  ]);

  const total = recipeTotal(recipe, byId);
  const availability = recipeAvailability(
    recipe,
    stockByIngredientId,
    ingredientsById,
  );
  const req = requirements(
    [
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        date: "2026-09-24",
        slotId: "22222222-2222-4222-8222-222222222203",
        entry: {
          kind: "recipeServings",
          recipeId: recipe.id,
          servings: 2,
        },
        position: 0,
        note: null,
        group: null,
      },
    ],
    { from: "2026-09-24", to: "2026-09-24" },
    {
      recipesById: new Map([[recipe.id, recipe]]),
      ingredientsById,
    },
  );
  const shop = shoppingList(req, [...stockByIngredientId.values()], null);
  const lineNutrition = nutritionOf(chicken, {
    amount: 100,
    kind: "mass",
  });
  return { total, availability, req, shop, lineNutrition };
}

describe("provenance invariance (R2.2)", () => {
  it("does not change derived results when source.kind and common are permuted", () => {
    const baseline = deriveBundle([chicken, rice]);

    for (const kind of kinds) {
      for (const common of [true, false]) {
        const mutated = [
          {
            ...chicken,
            source: { ...chicken.source, kind },
            common,
          },
          {
            ...rice,
            source: { ...rice.source, kind },
            common: !common,
          },
        ];
        expect(deriveBundle(mutated)).toEqual(baseline);
      }
    }
  });
});

describe("reference divergence (R2.4)", () => {
  const referenceChicken = baseIngredient({
    id: chickenId,
    name: "Chicken",
    source: {
      kind: "reference",
      datasetId: "cofid-2021",
      datasetName: "CoFID 2021",
      entryCode: "18-123",
      entryName: "Chicken, raw",
      licence: "OGL-UK-3.0",
      url: "https://example.test/cofid",
      retrievedAt: "2026-09-01",
      note: null,
    },
    common: false,
  });

  it("flips kind to userEntered while preserving origin fields", () => {
    const next = prepareIngredientPut(referenceChicken, {
      ...referenceChicken,
      nutrition: { kcal: 200, proteinG: 20, carbsG: 0, fatG: 10 },
    });
    expect(next.source.kind).toBe("userEntered");
    expect(next.source.datasetId).toBe("cofid-2021");
    expect(next.source.entryCode).toBe("18-123");
    expect(hasDivergedFromReference(next)).toBe(true);
  });

  it("rejects origin field mutation", () => {
    expect(() =>
      prepareIngredientPut(referenceChicken, {
        ...referenceChicken,
        source: {
          ...referenceChicken.source,
          entryCode: "tampered",
        },
      }),
    ).toThrow(OriginImmutabilityError);
  });
});

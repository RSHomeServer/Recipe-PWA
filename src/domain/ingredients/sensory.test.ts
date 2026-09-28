import { describe, expect, it } from "vitest";
import {
  IngredientSchema,
  RecipeSchema,
  calorieDense,
  highSodium,
  sodiumUnknown,
  flavourProfile,
  FLAVOUR_TAGS,
  FlavourTagSchema,
  CALORIE_DENSE_KCAL_PER_100G,
  HIGH_SODIUM_MG_PER_100G,
  defaultUserEnteredSource,
  nutritionOf,
  recipeAvailability,
  recipeTotal,
  requirements,
  shoppingList,
  expand,
  expandAll,
  expandCtxFromMaps,
  byDay,
  byMeal,
  byRecipe,
  byIngredient,
  weekTotals,
  totalNutrition,
  type Ingredient,
  type Recipe,
  type LoggedMeal,
  type FlavourTag,
} from "@/domain";
import flavourPackJson from "../../../public/starter-pack/flavour-pack.json";
import flavourTagsMap from "@/data/flavour-tags/flavour-tags.json";

const chickenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const riceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const spiceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function baseIngredient(
  overrides: Partial<Ingredient> & Pick<Ingredient, "id" | "name">,
): Ingredient {
  return IngredientSchema.parse({
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6, sodiumMg: null },
    notes: null,
    archivedAt: null,
    source: defaultUserEnteredSource(),
    imageId: null,
    common: true,
    gramsPerTsp: null,
    gramsPerTbsp: null,
    flavourTags: [],
    ...overrides,
  });
}

function line(
  id: string,
  ingredientId: string,
  amount: number,
  optional = false,
) {
  return {
    id,
    ingredientId,
    quantity: { amount, kind: "mass" as const },
    displayUnit: "g" as const,
    optional,
    note: null,
    entryHint: null,
  };
}

const chicken = baseIngredient({
  id: chickenId,
  name: "Chicken",
  nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6, sodiumMg: null },
});

const rice = baseIngredient({
  id: riceId,
  name: "Rice",
  nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, sodiumMg: null },
});

const recipe: Recipe = RecipeSchema.parse({
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Bowl",
  servings: 2,
  lines: [
    line("11111111-1111-4111-8111-111111111111", chickenId, 500),
    line("22222222-2222-4222-8222-222222222222", riceId, 300),
  ],
  steps: [],
  tags: [],
  imageId: null,
  notes: null,
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z",
  kind: "dish",
  archivedAt: null,
});

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

  const logged: LoggedMeal = {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    date: "2026-09-24",
    slotId: "22222222-2222-4222-8222-222222222203",
    entry: {
      kind: "recipeServings",
      recipeId: recipe.id,
      servings: 1,
    },
    loggedAt: "2026-09-24T12:00:00.000Z",
    plannedMealId: null,
    note: null,
    group: null,
  };
  const expandCtx = expandCtxFromMaps(
    new Map([[recipe.id, recipe]]),
    new Map(),
    ingredientsById,
  );
  const contrib = expand(logged, expandCtx);
  const all = expandAll([logged], expandCtx);

  return {
    total,
    availability,
    req,
    shop,
    lineNutrition,
    contrib,
    all,
    byDay: byDay(all),
    byMeal: byMeal(all),
    byRecipe: byRecipe(all),
    byIngredient: byIngredient(all),
    weekTotals: weekTotals(all),
    totalNutrition: totalNutrition(all),
  };
}

describe("FlavourTag schema (R4.1)", () => {
  it("accepts empty tags and rejects values outside the sixteen", () => {
    expect(
      IngredientSchema.parse({
        ...chicken,
        flavourTags: [],
      }).flavourTags,
    ).toEqual([]);
    expect(() =>
      IngredientSchema.parse({
        ...chicken,
        flavourTags: ["smoky", "not-a-tag"],
      }),
    ).toThrow();
    expect(FlavourTagSchema.options).toHaveLength(16);
    expect(FLAVOUR_TAGS).toHaveLength(16);
  });
});

describe("flavourTags invariance (R4.3)", () => {
  it("keeps derived results byte-identical when flavourTags are permuted", () => {
    const baseline = deriveBundle([chicken, rice]);
    const permutations: FlavourTag[][] = [
      [],
      ["smoky"],
      ["sour", "spicy"],
      [...FLAVOUR_TAGS],
      ["umami", "salty", "fermented"],
    ];
    for (const tagsA of permutations) {
      for (const tagsB of permutations) {
        const mutated = [
          { ...chicken, flavourTags: tagsA },
          { ...rice, flavourTags: tagsB },
        ];
        expect(deriveBundle(mutated)).toEqual(baseline);
      }
    }
  });
});

describe("flavourProfile (R4.4)", () => {
  it("unions non-optional line tags and excludes optional lines", () => {
    const paprika = baseIngredient({
      id: spiceId,
      name: "Paprika",
      flavourTags: ["smoky", "earthy", "aromatic"],
    });
    const garlic = baseIngredient({
      id: "99999999-9999-4999-8999-999999999999",
      name: "Garlic",
      flavourTags: ["aromatic", "spicy"],
    });
    const lime = baseIngredient({
      id: "88888888-8888-4888-8888-888888888888",
      name: "Lime",
      flavourTags: ["sour", "fresh"],
    });
    const mix: Recipe = {
      ...recipe,
      id: "77777777-7777-4777-8777-777777777777",
      name: "Chilli mix",
      kind: "mix",
      lines: [
        line("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", paprika.id, 5),
        line("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", garlic.id, 10),
        line("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", lime.id, 5, true),
      ],
    };
    const byId = new Map<string, Ingredient>([
      [paprika.id, paprika],
      [garlic.id, garlic],
      [lime.id, lime],
    ]);
    expect(flavourProfile(mix, byId)).toEqual([
      "spicy",
      "smoky",
      "aromatic",
      "earthy",
    ]);

    byId.set(paprika.id, { ...paprika, flavourTags: ["smoky"] });
    expect(flavourProfile(mix, byId)).toEqual([
      "spicy",
      "smoky",
      "aromatic",
    ]);
  });
});

describe("predicates (R4.5–R4.6)", () => {
  it("uses single thresholds and seeded tahini / vinegar figures", () => {
    expect(CALORIE_DENSE_KCAL_PER_100G).toBe(400);
    expect(HIGH_SODIUM_MG_PER_100G).toBe(600);

    // Seeded CoFID figures (pack.json): tahini 14-847 = 607 kcal, vinegar 17-339 = 22 kcal.
    expect(calorieDense({ kcal: 607 })).toBe(true);
    expect(calorieDense({ kcal: 22 })).toBe(false);
    expect(flavourTagsMap.tags["cofid-2021::14-847"]).toContain("nutty");
    expect(flavourTagsMap.tags["cofid-2021::17-339"]).toContain("sour");

    expect(highSodium({ sodiumMg: null })).toBe(false);
    expect(sodiumUnknown({ sodiumMg: null })).toBe(true);
    expect(highSodium({ sodiumMg: 600 })).toBe(true);
    expect(highSodium({ sodiumMg: 599 })).toBe(false);
    expect(sodiumUnknown({ sodiumMg: 0 })).toBe(false);
  });
});

describe("pack paprika smoky (Architect note)", () => {
  it("tags paprika with smoky", () => {
    const paprika = flavourPackJson.ingredients.find(
      (i) => i.source.entryCode === "171329",
    );
    expect(paprika?.flavourTags).toContain("smoky");
  });
});

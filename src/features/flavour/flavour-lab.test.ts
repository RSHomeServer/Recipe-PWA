import { describe, expect, it } from "vitest";
import {
  IngredientSchema,
  MealTemplateSchema,
  RecipeSchema,
  defaultMixLineDraft,
  defaultUserEnteredSource,
  draftsToRecipeInput,
  expand,
  expandAll,
  expandCtxFromMaps,
  expandTemplateToPlannedMeals,
  nutritionOf,
  recipePerServing,
  recipeTotal,
  sum,
  totalNutrition,
  type Ingredient,
  type LoggedMeal,
  type MealTemplate,
  type Recipe,
} from "@/domain";

/**
 * V3 worked example (R5.5, R5.7 / V3_SCOPE test 11):
 * Chilli Garlic Vinegar at 3 servings → snack of 200 g cucumber + 1 serving.
 */
function spice(
  overrides: Partial<Ingredient> & Pick<Ingredient, "id" | "name">,
): Ingredient {
  return IngredientSchema.parse({
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 20, proteinG: 0, carbsG: 1, fatG: 0, sodiumMg: 10 },
    notes: null,
    archivedAt: null,
    source: defaultUserEnteredSource(),
    imageId: null,
    common: true,
    gramsPerTsp: 2,
    gramsPerTbsp: null,
    flavourTags: ["sour", "spicy"],
    ...overrides,
  });
}

describe("Flavour Lab worked example (R5.5, R5.7)", () => {
  const vinegar = spice({
    id: "11111111-1111-4111-8111-111111111101",
    name: "Rice vinegar",
    nutrition: { kcal: 18, proteinG: 0, carbsG: 0.1, fatG: 0, sodiumMg: 2 },
    gramsPerTsp: null,
    measureKind: "volume",
    flavourTags: ["sour"],
  });
  const garlic = spice({
    id: "11111111-1111-4111-8111-111111111102",
    name: "Garlic powder",
    nutrition: { kcal: 331, proteinG: 17, carbsG: 73, fatG: 0.7, sodiumMg: 60 },
    flavourTags: ["aromatic"],
  });
  const chilli = spice({
    id: "11111111-1111-4111-8111-111111111103",
    name: "Chilli flakes",
    nutrition: { kcal: 282, proteinG: 12, carbsG: 50, fatG: 14, sodiumMg: 30 },
    flavourTags: ["spicy"],
  });
  const msg = spice({
    id: "11111111-1111-4111-8111-111111111104",
    name: "MSG",
    nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 12500 },
    flavourTags: ["umami", "salty"],
  });
  const salt = spice({
    id: "11111111-1111-4111-8111-111111111105",
    name: "Salt",
    nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 38758 },
    flavourTags: ["salty"],
  });
  const cucumber = spice({
    id: "11111111-1111-4111-8111-111111111106",
    name: "Cucumber",
    nutrition: { kcal: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1, sodiumMg: 2 },
    gramsPerTsp: null,
    flavourTags: ["fresh"],
  });

  const byId = new Map<string, Ingredient>([
    [vinegar.id, vinegar],
    [garlic.id, garlic],
    [chilli.id, chilli],
    [msg.id, msg],
    [salt.id, salt],
    [cucumber.id, cucumber],
  ]);

  it("defaults mix lines to tsp when cited, else small mass/volume", () => {
    expect(defaultMixLineDraft(garlic)).toMatchObject({
      amount: 1,
      entryMeasure: "tsp",
    });
    expect(defaultMixLineDraft(vinegar)).toMatchObject({
      amount: 5,
      entryMeasure: "ml",
    });
    expect(defaultMixLineDraft(cucumber)).toMatchObject({
      amount: 1,
      entryMeasure: "g",
    });
  });

  it("saves a mix recipe and snack template whose logged nutrition matches", () => {
    const mix: Recipe = RecipeSchema.parse({
      id: "22222222-2222-4222-8222-222222222201",
      name: "Chilli Garlic Vinegar",
      servings: 3,
      kind: "mix",
      lines: [
        {
          id: "33333333-3333-4333-8333-333333333301",
          ingredientId: vinegar.id,
          quantity: { amount: 30, kind: "volume" },
          displayUnit: "ml",
          optional: false,
          note: null,
          entryHint: null,
        },
        {
          id: "33333333-3333-4333-8333-333333333302",
          ingredientId: garlic.id,
          quantity: { amount: 2, kind: "mass" },
          displayUnit: "g",
          optional: false,
          note: null,
          entryHint: null,
        },
        {
          id: "33333333-3333-4333-8333-333333333303",
          ingredientId: chilli.id,
          quantity: { amount: 1, kind: "mass" },
          displayUnit: "g",
          optional: false,
          note: null,
          entryHint: null,
        },
        {
          id: "33333333-3333-4333-8333-333333333304",
          ingredientId: msg.id,
          quantity: { amount: 1, kind: "mass" },
          displayUnit: "g",
          optional: false,
          note: null,
          entryHint: null,
        },
        {
          id: "33333333-3333-4333-8333-333333333305",
          ingredientId: salt.id,
          quantity: { amount: 0.5, kind: "mass" },
          displayUnit: "g",
          optional: false,
          note: null,
          entryHint: null,
        },
      ],
      steps: [],
      tags: [],
      imageId: null,
      notes: null,
      createdAt: "2026-09-29T00:00:00.000Z",
      updatedAt: "2026-09-29T00:00:00.000Z",
      archivedAt: null,
    });

    expect(mix.kind).toBe("mix");
    const total = recipeTotal(mix, Object.fromEntries(byId));
    const perServing = recipePerServing(mix, Object.fromEntries(byId));
    expect(perServing.kcal).toBeCloseTo(total.kcal / 3, 6);

    const snack: MealTemplate = MealTemplateSchema.parse({
      id: "44444444-4444-4444-8444-444444444401",
      name: "Chilli Garlic Cucumber",
      components: [
        {
          id: "55555555-5555-4555-8555-555555555501",
          entry: {
            kind: "ingredient",
            ingredientId: cucumber.id,
            quantity: { value: 200, unit: "g" },
          },
          note: null,
        },
        {
          id: "55555555-5555-4555-8555-555555555502",
          entry: {
            kind: "recipeServings",
            recipeId: mix.id,
            servings: 1,
          },
          note: null,
        },
      ],
      defaultSlotId: "66666666-6666-4666-8666-666666666601",
      createdAt: "2026-09-29T00:00:00.000Z",
      updatedAt: "2026-09-29T00:00:00.000Z",
      archivedAt: null,
    });

    const planned = expandTemplateToPlannedMeals({
      template: snack,
      dates: ["2026-09-29"],
      slotId: "66666666-6666-4666-8666-666666666601",
      existing: [],
      nextId: (() => {
        let n = 0;
        return () => {
          n += 1;
          return `77777777-7777-4777-8777-${String(n).padStart(12, "0")}`;
        };
      })(),
    });
    expect(planned).toHaveLength(2);

    const logged: LoggedMeal[] = planned.map((meal, index) => ({
      id: `88888888-8888-4888-8888-${String(index + 1).padStart(12, "0")}`,
      date: meal.date,
      slotId: meal.slotId,
      entry: meal.entry,
      loggedAt: "2026-09-29T12:00:00.000Z",
      plannedMealId: meal.id,
      note: null,
      group: meal.group,
    }));

    const ctx = expandCtxFromMaps(
      new Map([[mix.id, mix]]),
      new Map(),
      byId,
    );
    const all = expandAll(logged, ctx);
    const loggedNutrition = totalNutrition(all);

    const cucumberPart = nutritionOf(cucumber, { amount: 200, kind: "mass" });
    const expected = sum([cucumberPart, perServing]);
    expect(loggedNutrition.kcal).toBeCloseTo(expected.kcal, 10);
    expect(loggedNutrition.proteinG).toBeCloseTo(expected.proteinG, 10);
    expect(loggedNutrition.carbsG).toBeCloseTo(expected.carbsG, 10);
    expect(loggedNutrition.fatG).toBeCloseTo(expected.fatG, 10);
    expect(loggedNutrition.sodiumMg).not.toBeNull();
    expect(expected.sodiumMg).not.toBeNull();
    expect(loggedNutrition.sodiumMg!).toBeCloseTo(expected.sodiumMg!, 10);

    // Live preview path used by the Flavour Lab builder.
    const drafts = mix.lines.map((line) => ({
      id: line.id,
      ingredientId: line.ingredientId,
      amount: line.quantity.amount,
      entryMeasure: line.displayUnit,
      optional: line.optional,
      note: line.note ?? "",
    }));
    const preview = draftsToRecipeInput(
      mix.name,
      mix.servings,
      drafts,
      byId,
    );
    expect(preview).not.toBeNull();
    if (preview) {
      expect(recipeTotal(preview, Object.fromEntries(byId))).toEqual(total);
    }

    // Spot-check expand of a single snack component.
    expect(expand(logged[0]!, ctx).length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { withinTolerance } from "../units";
import {
  ZERO,
  basis,
  batchNutrition,
  createSnapshot,
  formatKcal,
  formatMacroG,
  formatNutrition,
  formatPct,
  nutritionOf,
  portionNutrition,
  portionsNutrition,
  recipeBreakdown,
  recipePerServing,
  recipeTotal,
  scale,
  scaledLines,
  seedActualLines,
  sum,
  type Nutrition,
  type NutritionIngredient,
  type RecipeInput,
} from "./index";

const chicken: NutritionIngredient = {
  id: "ing-chicken",
  name: "Chicken",
  measureKind: "mass",
  nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6 },
};

const rice: NutritionIngredient = {
  id: "ing-rice",
  name: "Rice",
  measureKind: "mass",
  nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
};

const sauce: NutritionIngredient = {
  id: "ing-sauce",
  name: "Sauce",
  measureKind: "mass",
  nutrition: { kcal: 80, proteinG: 1, carbsG: 5, fatG: 6 },
};

const oil: NutritionIngredient = {
  id: "ing-oil",
  name: "Oil",
  measureKind: "volume",
  nutrition: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 },
};

/** Decision 6 Chicken Curry-shaped fixture (adjusted oils/sauce bases to hit example kcal). */
function chickenCurryFixture(): {
  recipe: RecipeInput;
  byId: Record<string, NutritionIngredient>;
} {
  // Line contributions from NUTRITION_MODEL worked example:
  // chicken 600, rice 450, sauce 200, oil 90 → total 1340 / 4 = 335
  const byId = {
    [chicken.id]: chicken,
    [rice.id]: {
      ...rice,
      // 450 kcal from 346.153… g at 130/100 — use quantity that yields 450
      nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
    },
    [sauce.id]: {
      ...sauce,
      nutrition: { kcal: 80, proteinG: 1, carbsG: 5, fatG: 6 },
    },
    [oil.id]: {
      ...oil,
      nutrition: { kcal: 900, proteinG: 0, carbsG: 0, fatG: 100 },
    },
  };

  const recipe: RecipeInput = {
    id: "recipe-curry",
    name: "Chicken Curry",
    servings: 4,
    lines: [
      {
        id: "l1",
        ingredientId: chicken.id,
        quantity: { amount: 500, kind: "mass" },
        displayUnit: "g",
        optional: false,
      },
      {
        id: "l2",
        ingredientId: rice.id,
        // 450 / 130 * 100 = 346.1538… g
        quantity: { amount: (450 / 130) * 100, kind: "mass" },
        displayUnit: "g",
        optional: false,
      },
      {
        id: "l3",
        ingredientId: sauce.id,
        // 200 / 80 * 100 = 250 g
        quantity: { amount: 250, kind: "mass" },
        displayUnit: "g",
        optional: false,
      },
      {
        id: "l4",
        ingredientId: oil.id,
        // 90 / 900 * 100 = 10 ml
        quantity: { amount: 10, kind: "volume" },
        displayUnit: "ml",
        optional: false,
      },
    ],
  };

  return { recipe, byId };
}

function nutritionClose(a: Nutrition, b: Nutrition, digits = 6): void {
  expect(a.kcal).toBeCloseTo(b.kcal, digits);
  expect(a.proteinG).toBeCloseTo(b.proteinG, digits);
  expect(a.carbsG).toBeCloseTo(b.carbsG, digits);
  expect(a.fatG).toBeCloseTo(b.fatG, digits);
}

describe("NUTRITION_MODEL §Testable properties (core scope)", () => {
  describe("1. sum is a commutative monoid with ZERO identity", () => {
    const a: Nutrition = { kcal: 10, proteinG: 1, carbsG: 2, fatG: 3 };
    const b: Nutrition = { kcal: 20, proteinG: 4, carbsG: 5, fatG: 6 };
    const c: Nutrition = { kcal: 7, proteinG: 0.5, carbsG: 0, fatG: 1.25 };

    it("ZERO is identity", () => {
      nutritionClose(sum([a, ZERO]), a);
      nutritionClose(sum([ZERO, a]), a);
      nutritionClose(sum([]), ZERO);
    });

    it("commutative", () => {
      nutritionClose(sum([a, b, c]), sum([c, a, b]));
      nutritionClose(sum([a, b]), sum([b, a]));
    });

    it("associative", () => {
      nutritionClose(sum([sum([a, b]), c]), sum([a, sum([b, c])]));
    });
  });

  describe("2. scale distributes over sum", () => {
    const xs: Nutrition[] = [
      { kcal: 100, proteinG: 10, carbsG: 0, fatG: 2 },
      { kcal: 50, proteinG: 0, carbsG: 12, fatG: 1 },
      { kcal: 25, proteinG: 3, carbsG: 4, fatG: 0.5 },
    ];

    it.each([0, 0.5, 1, 2, 7])("factor %s", (f) => {
      nutritionClose(
        scale(sum(xs), f),
        sum(xs.map((x) => scale(x, f))),
      );
    });
  });

  describe("3. recipeTotal === sum(breakdown nutrition); shares ≈ 100%", () => {
    it("Chicken Curry worked example", () => {
      const { recipe, byId } = chickenCurryFixture();
      const total = recipeTotal(recipe, byId);
      expect(total.kcal).toBeCloseTo(1340, 6);
      expect(recipePerServing(recipe, byId).kcal).toBeCloseTo(335, 6);

      const breakdown = recipeBreakdown(recipe, byId);
      const explained = sum(breakdown.filter((r) => !r.optional).map((r) => r.nutrition));
      nutritionClose(explained, total);

      const shareSum = breakdown
        .filter((r) => !r.optional)
        .reduce((acc, r) => acc + (r.shareOfKcal ?? 0), 0);
      expect(shareSum).toBeCloseTo(1, 10);

      expect(breakdown.map((r) => Math.round((r.shareOfKcal ?? 0) * 100))).toEqual([
        45, 34, 15, 7,
      ]);
    });

    it("optional lines excluded from headline totals but listed in breakdown", () => {
      const { recipe, byId } = chickenCurryFixture();
      const withOptional: RecipeInput = {
        ...recipe,
        lines: [
          ...recipe.lines,
          {
            id: "l-opt",
            ingredientId: chicken.id,
            quantity: { amount: 100, kind: "mass" },
            displayUnit: "g",
            optional: true,
          },
        ],
      };
      const total = recipeTotal(withOptional, byId);
      expect(total.kcal).toBeCloseTo(1340, 6);

      const rows = recipeBreakdown(withOptional, byId);
      const optionalRow = rows.find((r) => r.optional);
      expect(optionalRow?.shareOfKcal).toBeNull();
      expect(optionalRow?.nutrition.kcal).toBeCloseTo(120, 6);
    });
  });

  describe("4–5. batch snapshot / portion helpers", () => {
    it("portionsNutrition(b, portionsNominal) === snapshot.total", () => {
      const { recipe, byId } = chickenCurryFixture();
      const snapshot = createSnapshot(
        recipe,
        byId,
        seedActualLines(recipe, 2),
      );
      const batch = { portionsNominal: 8, snapshot };
      nutritionClose(portionsNutrition(batch, batch.portionsNominal), snapshot.total);
      nutritionClose(batchNutrition(batch), snapshot.total);
      expect(portionNutrition(batch).kcal).toBeCloseTo(snapshot.total.kcal / 8, 6);
    });

    it("snapshot.total === sum(line nutritions)", () => {
      const { recipe, byId } = chickenCurryFixture();
      const snapshot = createSnapshot(recipe, byId, seedActualLines(recipe, 1));
      nutritionClose(
        snapshot.total,
        sum(snapshot.lines.map((l) => l.nutrition)),
      );
    });

    it("edited cook quantities (550 g chicken) land in the snapshot", () => {
      const { recipe, byId } = chickenCurryFixture();
      const seeded = seedActualLines(recipe, 1);
      const actual = seeded.map((l) =>
        l.ingredientId === chicken.id
          ? { ...l, quantity: { amount: 550, kind: "mass" as const } }
          : l,
      );
      const snapshot = createSnapshot(recipe, byId, actual);
      const chickenLine = snapshot.lines.find((l) => l.ingredientId === chicken.id);
      expect(chickenLine?.quantity.amount).toBe(550);
      nutritionClose(
        chickenLine!.nutrition,
        nutritionOf(chicken, { amount: 550, kind: "mass" }),
      );
    });
  });

  describe("10. zero quantity / zero scale → ZERO", () => {
    it("nutritionOf(ing, 0) === ZERO", () => {
      nutritionClose(
        nutritionOf(chicken, { amount: 0, kind: "mass" }),
        ZERO,
      );
    });

    it("scaling recipe by zero servings yields ZERO line amounts", () => {
      const { recipe } = chickenCurryFixture();
      const lines = scaledLines(recipe, 0);
      for (const line of lines) {
        expect(withinTolerance(line.quantity.amount, 0, line.quantity.kind)).toBe(
          true,
        );
      }
    });

    it("portionsNutrition(..., 0) === ZERO", () => {
      const { recipe, byId } = chickenCurryFixture();
      const snapshot = createSnapshot(recipe, byId, seedActualLines(recipe, 1));
      nutritionClose(
        portionsNutrition({ portionsNominal: 4, snapshot }, 0),
        ZERO,
      );
    });
  });

  describe("11. display rounding is stable and precision-capped", () => {
    it("formats the same value identically twice", () => {
      const n: Nutrition = {
        kcal: 523.7,
        proteinG: 42.37,
        carbsG: 10.05,
        fatG: 1.04,
      };
      expect(formatNutrition(n)).toEqual(formatNutrition(n));
      expect(formatKcal(n.kcal)).toBe("524");
      expect(formatMacroG(n.proteinG)).toBe("42.4");
      expect(formatPct(0.45)).toBe("45");
    });

    it("chicken 500 g worked example (decision 3)", () => {
      const n = nutritionOf(chicken, { amount: 500, kind: "mass" });
      nutritionClose(n, {
        kcal: 600,
        proteinG: 115,
        carbsG: 0,
        fatG: 13,
      });
      expect(basis("mass")).toBe(100);
      expect(basis("volume")).toBe(100);
      expect(basis("count")).toBe(1);
    });
  });

  it.todo(
    "6. History immutability — create batch, log portions, edit recipe/ingredient; snapshot + expand() stay byte-identical (needs persistence + logging; steps 3 + 7 / 10–11)",
  );
});

import type { MeasureKind } from "../units/schemas";
import type { Nutrition, NutritionIngredient } from "./schemas";
import type { CanonicalQuantity } from "../units/schemas";

export const ZERO: Nutrition = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  sodiumMg: 0,
};

/** Fixed nutrition basis implied by measure kind (decision 3). */
export function basis(kind: MeasureKind): number {
  return kind === "count" ? 1 : 100;
}

export function scale(n: Nutrition, f: number): Nutrition {
  return {
    kcal: n.kcal * f,
    proteinG: n.proteinG * f,
    carbsG: n.carbsG * f,
    fatG: n.fatG * f,
    sodiumMg: n.sodiumMg === null ? null : n.sodiumMg * f,
  };
}

export function sum(ns: readonly Nutrition[]): Nutrition {
  return ns.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      proteinG: acc.proteinG + n.proteinG,
      carbsG: acc.carbsG + n.carbsG,
      fatG: acc.fatG + n.fatG,
      sodiumMg:
        acc.sodiumMg === null || n.sodiumMg === null
          ? null
          : acc.sodiumMg + n.sodiumMg,
    }),
    ZERO,
  );
}

/**
 * Nutrition for a canonical quantity of an ingredient.
 * Same measureKind is required — a programming error if violated.
 */
export function nutritionOf(
  ingredient: NutritionIngredient,
  q: CanonicalQuantity,
): Nutrition {
  if (q.kind !== ingredient.measureKind) {
    throw new Error(
      `nutritionOf: quantity kind ${q.kind} does not match ingredient ${ingredient.measureKind}`,
    );
  }
  return scale(ingredient.nutrition, q.amount / basis(ingredient.measureKind));
}

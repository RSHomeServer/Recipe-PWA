import type { Ingredient } from "../ingredients/schemas";
import { createId } from "../shared/primitives";
import {
  defaultUnitForKind,
  type RecipeLineDraft,
} from "../recipes/form";

/**
 * Sensible default quantity when rapidly multi-picking into a mix (R5.4).
 * Prefer 1 tsp when a cited tsp weight exists; otherwise 1 g / 5 ml / 1 item.
 */
export function defaultMixLineDraft(ingredient: Ingredient): RecipeLineDraft {
  if (
    ingredient.measureKind === "mass" &&
    ingredient.gramsPerTsp != null
  ) {
    return {
      id: createId(),
      ingredientId: ingredient.id,
      amount: 1,
      entryMeasure: "tsp",
      optional: false,
      note: "",
    };
  }

  if (ingredient.measureKind === "volume") {
    return {
      id: createId(),
      ingredientId: ingredient.id,
      amount: 5,
      entryMeasure: "ml",
      optional: false,
      note: "",
    };
  }

  if (ingredient.measureKind === "count") {
    return {
      id: createId(),
      ingredientId: ingredient.id,
      amount: 1,
      entryMeasure: defaultUnitForKind("count"),
      optional: false,
      note: "",
    };
  }

  return {
    id: createId(),
    ingredientId: ingredient.id,
    amount: 1,
    entryMeasure: "g",
    optional: false,
    note: "",
  };
}

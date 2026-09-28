/** Derived mix flavour profile — never stored (ADR-009 / R4.4). */

import type { Ingredient, FlavourTag } from "./schemas";
import { FLAVOUR_TAGS } from "./schemas";
import type { Recipe } from "../recipes/schemas";

/**
 * Union of flavour tags on non-optional recipe lines.
 * Optional lines are excluded, matching headline nutrition.
 * Ordered by the closed vocabulary.
 */
export function flavourProfile(
  recipe: Pick<Recipe, "lines">,
  ingredientsById: ReadonlyMap<string, Ingredient>,
): FlavourTag[] {
  const present = new Set<FlavourTag>();
  for (const line of recipe.lines) {
    if (line.optional) continue;
    const ingredient = ingredientsById.get(line.ingredientId);
    if (!ingredient) continue;
    for (const tag of ingredient.flavourTags) {
      present.add(tag);
    }
  }
  return FLAVOUR_TAGS.filter((tag) => present.has(tag));
}

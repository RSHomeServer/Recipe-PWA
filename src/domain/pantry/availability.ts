import type { Ingredient } from "../ingredients/schemas";
import type { Recipe } from "../recipes/schemas";
import { isShort, isZero } from "../units/compare";
import { formatQuantity } from "../units/format";
import type { CanonicalQuantity } from "../units/schemas";
import { zeroQuantity } from "../units/sum";
import type { PantryStock } from "./schemas";

/**
 * UX classification threshold (decision 11 / OPEN_QUESTIONS).
 * Tune after usability testing — not a domain truth.
 */
export const ALMOST_CAN_MAKE_MAX_MISSING = 2;

export type Shortfall = {
  ingredientId: string;
  required: CanonicalQuantity;
  available: CanonicalQuantity;
  short: CanonicalQuantity;
};

export type Availability =
  | { status: "canMake"; shortfalls: [] }
  | { status: "almostCanMake"; shortfalls: Shortfall[] }
  | { status: "missingSignificant"; shortfalls: Shortfall[] };

export type RecipeAvailability = {
  recipeId: string;
  availability: Availability;
};

function stockAmount(
  stockByIngredientId: ReadonlyMap<string, PantryStock>,
  ingredientId: string,
  kind: CanonicalQuantity["kind"],
): CanonicalQuantity {
  const row = stockByIngredientId.get(ingredientId);
  if (!row) return zeroQuantity(kind);
  return row.quantity;
}

/**
 * Derive availability for one recipe vs pantry stock.
 * Optional lines are ignored. Classification is by shortfall count only.
 */
export function recipeAvailability(
  recipe: Recipe,
  stockByIngredientId: ReadonlyMap<string, PantryStock>,
  ingredientsById: ReadonlyMap<string, Ingredient>,
): Availability {
  const shortfalls: Shortfall[] = [];

  for (const line of recipe.lines) {
    if (line.optional) continue;

    const ingredient = ingredientsById.get(line.ingredientId);
    const kind = ingredient?.measureKind ?? line.quantity.kind;
    const required = line.quantity;
    const available = stockAmount(
      stockByIngredientId,
      line.ingredientId,
      kind,
    );

    if (available.kind !== required.kind) {
      // Programming / data error: treat as fully short so the UI surfaces it.
      shortfalls.push({
        ingredientId: line.ingredientId,
        required,
        available: zeroQuantity(required.kind),
        short: required,
      });
      continue;
    }

    if (!isShort(required.amount, available.amount, required.kind)) {
      continue;
    }

    const shortAmount = required.amount - available.amount;
    shortfalls.push({
      ingredientId: line.ingredientId,
      required,
      available,
      short: { amount: shortAmount, kind: required.kind },
    });
  }

  if (shortfalls.length === 0) {
    return { status: "canMake", shortfalls: [] };
  }
  if (shortfalls.length <= ALMOST_CAN_MAKE_MAX_MISSING) {
    return { status: "almostCanMake", shortfalls };
  }
  return { status: "missingSignificant", shortfalls };
}

/** Availability for every non-archived recipe. */
export function availabilityForAll(
  recipes: readonly Recipe[],
  stock: readonly PantryStock[],
  ingredients: readonly Ingredient[],
): RecipeAvailability[] {
  const stockByIngredientId = new Map(
    stock.map((row) => [row.ingredientId, row]),
  );
  const ingredientsById = new Map(
    ingredients.map((row) => [row.id, row]),
  );

  return recipes
    .filter((recipe) => recipe.archivedAt == null)
    .map((recipe) => ({
      recipeId: recipe.id,
      availability: recipeAvailability(
        recipe,
        stockByIngredientId,
        ingredientsById,
      ),
    }));
}

/** Presentational shortfall labels for AvailabilityIndicator. */
export function formatShortfallLabel(
  shortfall: Shortfall,
  ingredientName: string,
): string {
  const qty = formatQuantity(shortfall.short);
  return `${ingredientName} ${qty}`;
}

export function formatShortfallLabels(
  shortfalls: readonly Shortfall[],
  ingredientsById: ReadonlyMap<string, Ingredient>,
): string[] {
  return shortfalls.map((shortfall) => {
    const name =
      ingredientsById.get(shortfall.ingredientId)?.name ?? "Unknown";
    return formatShortfallLabel(shortfall, name);
  });
}

/** True when a pantry row is meaningfully negative (needs correction UX). */
export function isNegativeStock(quantity: CanonicalQuantity): boolean {
  return quantity.amount < 0 && !isZero(quantity.amount, quantity.kind);
}

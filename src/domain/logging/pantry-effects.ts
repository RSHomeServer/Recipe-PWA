import type { Ingredient } from "../ingredients/schemas";
import type { IsoDateTime } from "../shared/primitives";
import type { MealEntry } from "../shared/meal-entry";
import type { Quantity } from "../units/schemas";
import {
  addStock,
  removeStock,
  type StockMutationResult,
} from "../pantry/stock";
import type { PantryStock } from "../pantry/schemas";

/**
 * What logging an entry should do to pantry stock.
 * Only bare `ingredient` entries deduct; all other kinds are no-ops
 * (DOMAIN_MODEL §Meal Log invariant 3).
 */
export type PantrySideEffect =
  | { kind: "none" }
  | {
      kind: "ingredient";
      ingredientId: string;
      quantity: Quantity;
    };

export type PantryEffectResult =
  | { ok: true; stock: PantryStock | null }
  | { ok: false; reason: "missingIngredient" }
  | Extract<StockMutationResult, { ok: false }>;

export function pantrySideEffectForEntry(entry: MealEntry): PantrySideEffect {
  if (entry.kind !== "ingredient") return { kind: "none" };
  return {
    kind: "ingredient",
    ingredientId: entry.ingredientId,
    quantity: entry.quantity,
  };
}

/**
 * Apply create-side pantry mutation (ingredient → remove stock).
 * Never blocks; negatives are allowed.
 */
export function applyPantryOnLogCreate(
  effect: PantrySideEffect,
  existing: PantryStock | undefined,
  ingredient: Ingredient | undefined,
  updatedAt: IsoDateTime,
): PantryEffectResult {
  if (effect.kind === "none") return { ok: true, stock: null };
  if (!ingredient) return { ok: false, reason: "missingIngredient" };
  return removeStock(existing, ingredient, effect.quantity, updatedAt);
}

/**
 * Reverse create-side pantry mutation on delete/edit (ingredient → add stock back).
 */
export function applyPantryOnLogReverse(
  effect: PantrySideEffect,
  existing: PantryStock | undefined,
  ingredient: Ingredient | undefined,
  updatedAt: IsoDateTime,
): PantryEffectResult {
  if (effect.kind === "none") return { ok: true, stock: null };
  if (!ingredient) return { ok: false, reason: "missingIngredient" };
  return addStock(existing, ingredient, effect.quantity, updatedAt);
}

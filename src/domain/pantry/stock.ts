import type { Ingredient } from "../ingredients/schemas";
import type { IsoDateTime } from "../shared/primitives";
import {
  toCanonical,
  type Validated,
} from "../units/convert";
import type {
  CanonicalQuantity,
  MeasureKind,
  Quantity,
} from "../units/schemas";
import { zeroQuantity } from "../units/sum";
import type { PantryStock } from "./schemas";

export type StockMutation =
  | { op: "add"; quantity: Quantity }
  | { op: "remove"; quantity: Quantity }
  | { op: "set"; quantity: Quantity };

export type StockMutationResult =
  | { ok: true; stock: PantryStock }
  | Extract<Validated, { ok: false }>;

function assertFamily(
  quantity: CanonicalQuantity,
  kind: MeasureKind,
): void {
  if (quantity.kind !== kind) {
    throw new Error(
      `Pantry stock kind mismatch: expected ${kind}, got ${quantity.kind}`,
    );
  }
}

/**
 * Apply add / remove / set against one ingredient's pantry row.
 * Missing rows are treated as zero. Negatives are never clamped.
 * Zero results keep the row ("known but not stocked").
 */
export function applyStockMutation(
  existing: PantryStock | undefined,
  ingredient: Ingredient,
  mutation: StockMutation,
  updatedAt: IsoDateTime,
): StockMutationResult {
  const converted = toCanonical(mutation.quantity, ingredient);
  if (!converted.ok) return converted;

  const delta = converted.canonical;
  const kind = ingredient.measureKind;
  assertFamily(delta, kind);

  const current =
    existing?.quantity ?? zeroQuantity(kind);
  if (existing) assertFamily(existing.quantity, kind);

  let nextAmount: number;
  switch (mutation.op) {
    case "add":
      nextAmount = current.amount + delta.amount;
      break;
    case "remove":
      nextAmount = current.amount - delta.amount;
      break;
    case "set":
      nextAmount = delta.amount;
      break;
  }

  return {
    ok: true,
    stock: {
      ingredientId: ingredient.id,
      quantity: { amount: nextAmount, kind },
      updatedAt,
    },
  };
}

/** Convenience: set absolute stock from a user quantity. */
export function setStock(
  existing: PantryStock | undefined,
  ingredient: Ingredient,
  quantity: Quantity,
  updatedAt: IsoDateTime,
): StockMutationResult {
  return applyStockMutation(
    existing,
    ingredient,
    { op: "set", quantity },
    updatedAt,
  );
}

export function addStock(
  existing: PantryStock | undefined,
  ingredient: Ingredient,
  quantity: Quantity,
  updatedAt: IsoDateTime,
): StockMutationResult {
  return applyStockMutation(
    existing,
    ingredient,
    { op: "add", quantity },
    updatedAt,
  );
}

export function removeStock(
  existing: PantryStock | undefined,
  ingredient: Ingredient,
  quantity: Quantity,
  updatedAt: IsoDateTime,
): StockMutationResult {
  return applyStockMutation(
    existing,
    ingredient,
    { op: "remove", quantity },
    updatedAt,
  );
}

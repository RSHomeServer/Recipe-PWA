import type { Ingredient } from "../ingredients/schemas";
import {
  createSnapshot,
  type SnapshotActualLine,
} from "../nutrition/batch";
import type { Recipe } from "../recipes/schemas";
import { isShort } from "../units/compare";
import { CANONICAL_UNIT } from "../units/table";
import type { CanonicalQuantity } from "../units/schemas";
import { zeroQuantity } from "../units/sum";
import {
  applyStockMutation,
  type StockMutationResult,
} from "../pantry/stock";
import type { Shortfall } from "../pantry/availability";
import type { PantryStock } from "../pantry/schemas";
import type { Batch } from "./schemas";
import { BatchSchema } from "./schemas";

export type CookBatchInput = {
  id: string;
  recipe: Recipe;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  scale: number;
  portionsNominal: number;
  actualLines: readonly SnapshotActualLine[];
  cookedAt: string;
  label: string | null;
  notes: string | null;
};

export type CookPantryPlan = {
  batch: Batch;
  shortfalls: Shortfall[];
  /** Resulting pantry rows after deducting snapshot actuals (may be negative). */
  pantryAfter: PantryStock[];
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
 * Shortfalls of **actual** cook quantities vs pantry (decision 12).
 * Does not block — callers surface ShortfallNotice and may cook anyway.
 */
export function shortfallsForActualLines(
  actualLines: readonly SnapshotActualLine[],
  stockByIngredientId: ReadonlyMap<string, PantryStock>,
  ingredientsById: ReadonlyMap<string, Ingredient>,
): Shortfall[] {
  const shortfalls: Shortfall[] = [];

  for (const line of actualLines) {
    const ingredient = ingredientsById.get(line.ingredientId);
    const kind = ingredient?.measureKind ?? line.quantity.kind;
    const required = line.quantity;
    const available = stockAmount(
      stockByIngredientId,
      line.ingredientId,
      kind,
    );

    if (available.kind !== required.kind) {
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

    shortfalls.push({
      ingredientId: line.ingredientId,
      required,
      available,
      short: {
        amount: required.amount - available.amount,
        kind: required.kind,
      },
    });
  }

  return shortfalls;
}

/**
 * Build an immutable batch + pantry deductions from actual lines.
 * Pure — no I/O. Persistence layer creates the batch and puts stock rows.
 */
export function planCookBatch(
  input: CookBatchInput,
  stockByIngredientId: ReadonlyMap<string, PantryStock>,
): CookPantryPlan {
  if (!(input.scale > 0)) {
    throw new Error("scale must be > 0");
  }
  if (!(input.portionsNominal > 0)) {
    throw new Error("portionsNominal must be > 0");
  }

  const nutritionById: Record<string, Ingredient> = Object.fromEntries(
    input.ingredientsById,
  );
  const snapshot = createSnapshot(
    input.recipe,
    nutritionById,
    input.actualLines,
  );

  const batch = BatchSchema.parse({
    id: input.id,
    recipeId: input.recipe.id,
    scale: input.scale,
    portionsNominal: input.portionsNominal,
    cookedAt: input.cookedAt,
    label: input.label,
    closedAt: null,
    notes: input.notes,
    snapshot,
  });

  const shortfalls = shortfallsForActualLines(
    input.actualLines,
    stockByIngredientId,
    input.ingredientsById,
  );

  const working = new Map(stockByIngredientId);
  const pantryAfter: PantryStock[] = [];

  for (const line of snapshot.lines) {
    const ingredient = input.ingredientsById.get(line.ingredientId);
    if (!ingredient) {
      throw new Error(`Unknown ingredient: ${line.ingredientId}`);
    }
    const existing = working.get(line.ingredientId);
    const result: StockMutationResult = applyStockMutation(
      existing,
      ingredient,
      {
        op: "remove",
        quantity: {
          value: line.quantity.amount,
          unit: CANONICAL_UNIT[line.quantity.kind],
        },
      },
      input.cookedAt,
    );
    if (!result.ok) {
      throw new Error(
        `Cannot deduct ${ingredient.name}: expected ${result.expected} unit`,
      );
    }
    working.set(line.ingredientId, result.stock);
    pantryAfter.push(result.stock);
  }

  return { batch, shortfalls, pantryAfter };
}

import type { Batch, Ingredient } from "@/domain";
import {
  nutritionEqual,
  originFieldsEqual,
} from "@/domain";

export class SnapshotImmutabilityError extends Error {
  constructor(batchId: string) {
    super(
      `Batch.snapshot is immutable and cannot be changed (batch ${batchId})`,
    );
    this.name = "SnapshotImmutabilityError";
  }
}

export class OriginImmutabilityError extends Error {
  constructor(ingredientId: string) {
    super(
      `Ingredient.source origin fields are write-once and cannot be changed (ingredient ${ingredientId})`,
    );
    this.name = "OriginImmutabilityError";
  }
}

/** Deep-equal via JSON (snapshots are plain JSON-friendly values). */
export function snapshotsEqual(
  a: Batch["snapshot"],
  b: Batch["snapshot"],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function assertSnapshotUnchanged(
  existing: Batch,
  nextSnapshot: Batch["snapshot"],
): void {
  if (!snapshotsEqual(existing.snapshot, nextSnapshot)) {
    throw new SnapshotImmutabilityError(existing.id);
  }
}

export function assertOriginUnchanged(
  existing: Ingredient,
  next: Ingredient,
): void {
  if (!originFieldsEqual(existing.source, next.source)) {
    throw new OriginImmutabilityError(existing.id);
  }
}

/**
 * Enforce write-once origin fields and flip `reference` → `userEntered` when
 * nutrition or cited spoon weights are edited (ADR-002 / ADR-008 R3.9).
 */
export function prepareIngredientPut(
  existing: Ingredient | undefined,
  next: Ingredient,
): Ingredient {
  if (!existing) return next;

  assertOriginUnchanged(existing, next);

  const spoonChanged =
    existing.gramsPerTsp !== next.gramsPerTsp ||
    existing.gramsPerTbsp !== next.gramsPerTbsp;
  const nutritionChanged = !nutritionEqual(existing.nutrition, next.nutrition);

  if (
    existing.source.kind === "reference" &&
    (nutritionChanged || spoonChanged)
  ) {
    return {
      ...next,
      source: {
        ...next.source,
        kind: "userEntered",
        note:
          spoonChanged && !nutritionChanged
            ? (next.source.note ??
              "Spoon weights edited by you (user provenance).")
            : next.source.note,
      },
    };
  }

  return next;
}

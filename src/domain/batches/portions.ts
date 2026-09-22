import type { LoggedMeal } from "../logging/schemas";
import type { Batch } from "./schemas";

/**
 * Portion counts are dimensionless. Use a tiny epsilon so float residue does not
 * leave a batch "available" after nominal exhaustion (DOMAIN_MODEL §Portion).
 */
export const PORTIONS_EPSILON = 1e-6;

/** Sum of `batchPortions` log entries for one batch. */
export function portionsConsumed(
  batchId: string,
  logs: readonly LoggedMeal[],
): number {
  let total = 0;
  for (const log of logs) {
    const entry = log.entry;
    if (entry.kind === "batchPortions" && entry.batchId === batchId) {
      total += entry.portions;
    }
  }
  return total;
}

/**
 * Derived remaining portions — never stored.
 * May be negative if the user logged more than nominal (warn, never block).
 */
export function portionsRemaining(
  batch: Pick<Batch, "id" | "portionsNominal">,
  logs: readonly LoggedMeal[],
): number {
  return batch.portionsNominal - portionsConsumed(batch.id, logs);
}

/** Clamped for display; underlying remaining may still be negative. */
export function portionsRemainingDisplay(
  batch: Pick<Batch, "id" | "portionsNominal">,
  logs: readonly LoggedMeal[],
): number {
  return Math.max(0, portionsRemaining(batch, logs));
}

/**
 * Available prepared food while not manually closed and remaining > ε.
 * Exhaustion does not require writing `closedAt`.
 */
export function isBatchAvailable(
  batch: Pick<Batch, "id" | "portionsNominal" | "closedAt">,
  logs: readonly LoggedMeal[],
): boolean {
  return (
    batch.closedAt === null &&
    portionsRemaining(batch, logs) > PORTIONS_EPSILON
  );
}

/** Manual write-off — never alters snapshot or historical nutrition. */
export function closeBatch(
  batch: Batch,
  closedAt: string,
): Batch {
  return { ...batch, closedAt };
}

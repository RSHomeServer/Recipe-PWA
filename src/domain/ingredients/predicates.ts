import type { Nutrition } from "../nutrition/schemas";

/** kcal per 100 g — ADR-009 / R4.5. Defined once; used everywhere. */
export const CALORIE_DENSE_KCAL_PER_100G = 400;

/** sodiumMg per 100 g — ADR-009 / R4.5. Defined once; used everywhere. */
export const HIGH_SODIUM_MG_PER_100G = 600;

/** Pure predicate: kcal per 100 g (or per 100 ml / per item basis) ≥ 400. */
export function calorieDense(nutrition: Pick<Nutrition, "kcal">): boolean {
  return nutrition.kcal >= CALORIE_DENSE_KCAL_PER_100G;
}

/** Pure predicate: sodiumMg is null (unknown). */
export function sodiumUnknown(
  nutrition: Pick<Nutrition, "sodiumMg">,
): boolean {
  return nutrition.sodiumMg == null;
}

/**
 * Pure predicate: sodiumMg per 100 g ≥ 600.
 * Unknown sodium is not high (R4.6) — use `sodiumUnknown` for that case.
 */
export function highSodium(nutrition: Pick<Nutrition, "sodiumMg">): boolean {
  if (nutrition.sodiumMg == null) return false;
  return nutrition.sodiumMg >= HIGH_SODIUM_MG_PER_100G;
}

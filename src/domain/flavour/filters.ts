import {
  calorieDense,
  highSodium,
  sodiumUnknown,
} from "../ingredients/predicates";
import type { FlavourTag, Ingredient } from "../ingredients/schemas";
import { kcalPerSpoon } from "../spoons";

/**
 * Flavour Lab discovery filters (ADR-010 / R5.2–R5.3).
 * Pure — no I/O; safe for unit tests and the page.
 */
export type FlavourLabFilters = {
  /** Multi-select; two tags → intersection (R5.3). */
  tags: readonly FlavourTag[];
  /**
   * Max kcal for the ceiling. Compared to kcal/tsp when a cited tsp weight
   * exists, otherwise kcal per 100 g (acceptance scenario).
   */
  maxKcal: number | null;
  /**
   * Max sodium mg on the same basis as nutrition.sodiumMg.
   * Unknown sodium is excluded — never treated as zero (R5.3).
   */
  maxSodiumMg: number | null;
  /** When true, only `common` ingredients. */
  commonOnly: boolean;
};

export const EMPTY_FLAVOUR_LAB_FILTERS: FlavourLabFilters = {
  tags: [],
  maxKcal: null,
  maxSodiumMg: null,
  commonOnly: true,
};

/**
 * Display / ceiling kcal for an ingredient: per tsp when cited, else per 100 g.
 */
export function effectiveKcalForCeiling(
  ingredient: Pick<
    Ingredient,
    "nutrition" | "measureKind" | "gramsPerTsp" | "gramsPerTbsp"
  >,
): number {
  const perTsp = kcalPerSpoon(ingredient, "tsp");
  if (perTsp != null) return perTsp;
  return ingredient.nutrition.kcal;
}

export function matchesFlavourFilters(
  ingredient: Ingredient,
  filters: FlavourLabFilters,
): boolean {
  if (ingredient.archivedAt != null) return false;
  if (filters.commonOnly && !ingredient.common) return false;

  if (filters.tags.length > 0) {
    for (const tag of filters.tags) {
      if (!ingredient.flavourTags.includes(tag)) return false;
    }
  }

  if (filters.maxKcal != null && Number.isFinite(filters.maxKcal)) {
    if (effectiveKcalForCeiling(ingredient) > filters.maxKcal) return false;
  }

  if (filters.maxSodiumMg != null && Number.isFinite(filters.maxSodiumMg)) {
    // R5.3 — unknown sodium must not pass a sodium ceiling as if it were 0.
    if (ingredient.nutrition.sodiumMg == null) return false;
    if (ingredient.nutrition.sodiumMg > filters.maxSodiumMg) return false;
  }

  return true;
}

export function filterFlavourIngredients(
  ingredients: readonly Ingredient[],
  filters: FlavourLabFilters,
): Ingredient[] {
  return ingredients
    .filter((ingredient) => matchesFlavourFilters(ingredient, filters))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

export type FlavourMarkers = {
  calorieDense: boolean;
  highSodium: boolean;
  sodiumUnknown: boolean;
};

export function flavourMarkers(
  nutrition: Ingredient["nutrition"],
): FlavourMarkers {
  return {
    calorieDense: calorieDense(nutrition),
    highSodium: highSodium(nutrition),
    sodiumUnknown: sodiumUnknown(nutrition),
  };
}

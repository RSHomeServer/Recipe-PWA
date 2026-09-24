/**
 * Map CoFID GROUP codes (Appendix B) onto Recipe starter category IDs.
 * Prefer GROUP over food-code prefix (ADR-002 §2a).
 */

/** @type {Readonly<Record<string, string>>} */
export const SEED_CATEGORY_IDS = {
  produce: "11111111-1111-4111-8111-111111111101",
  meatFish: "11111111-1111-4111-8111-111111111102",
  dairyEggs: "11111111-1111-4111-8111-111111111103",
  dryGoods: "11111111-1111-4111-8111-111111111104",
  oilsCondiments: "11111111-1111-4111-8111-111111111105",
  other: "11111111-1111-4111-8111-111111111106",
};

/**
 * @param {string | null | undefined} group
 * @returns {string}
 */
export function categoryIdForGroup(group) {
  const g = String(group ?? "")
    .trim()
    .toUpperCase();
  if (!g) return SEED_CATEGORY_IDS.other;

  const letter = g[0];
  switch (letter) {
    case "D": // vegetables
    case "F": // fruit
      return SEED_CATEGORY_IDS.produce;
    case "M": // meat
    case "J": // fish
      return SEED_CATEGORY_IDS.meatFish;
    case "B": // milk
    case "C": // eggs
      return SEED_CATEGORY_IDS.dairyEggs;
    case "A": // cereals
    case "G": // nuts & seeds
    case "S": // sugars / snacks
      return SEED_CATEGORY_IDS.dryGoods;
    case "O": // fats & oils
    case "H": // herbs & spices
    case "W": // soups, sauces, misc
      return SEED_CATEGORY_IDS.oilsCondiments;
    case "Q": // alcoholic beverages
    case "P": // soft drinks / infusions
    default:
      return SEED_CATEGORY_IDS.other;
  }
}

/**
 * Alcoholic beverages (GROUP Q*) are per 100 ml; everything else per 100 g.
 * @param {string | null | undefined} group
 * @returns {"mass" | "volume"}
 */
export function measureKindForGroup(group) {
  const g = String(group ?? "")
    .trim()
    .toUpperCase();
  return g.startsWith("Q") ? "volume" : "mass";
}

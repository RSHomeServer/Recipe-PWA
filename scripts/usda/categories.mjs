/**
 * Map USDA food_category_id onto Recipe starter category IDs.
 * Same ids as scripts/cofid/group-to-category.mjs.
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
 * @param {string | number | null | undefined} foodCategoryId
 * @returns {string}
 */
export function categoryIdForUsdaCategory(foodCategoryId) {
  const id = String(foodCategoryId ?? "").trim();
  switch (id) {
    case "2": // Spices and Herbs
    case "4": // Fats and Oils
    case "6": // Soups, Sauces, and Gravies
      return SEED_CATEGORY_IDS.oilsCondiments;
    case "9": // Fruits and Fruit Juices (lemon/lime juice)
    case "11": // Vegetables and Vegetable Products
      return SEED_CATEGORY_IDS.produce;
    case "16": // Legumes and Legume Products (miso, soy)
      return SEED_CATEGORY_IDS.oilsCondiments;
    case "19": // Sweets (tabletop sweeteners)
      return SEED_CATEGORY_IDS.dryGoods;
    default:
      return SEED_CATEGORY_IDS.oilsCondiments;
  }
}

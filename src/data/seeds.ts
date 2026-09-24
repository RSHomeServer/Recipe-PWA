import type { IngredientCategory, MealSlot, Settings } from "@/domain";
import { DEFAULT_SETTINGS } from "@/domain";

/** Stable seed IDs so first-run rows are predictable across installs. */
export const SEED_CATEGORY_IDS = {
  produce: "11111111-1111-4111-8111-111111111101",
  meatFish: "11111111-1111-4111-8111-111111111102",
  dairyEggs: "11111111-1111-4111-8111-111111111103",
  dryGoods: "11111111-1111-4111-8111-111111111104",
  oilsCondiments: "11111111-1111-4111-8111-111111111105",
  other: "11111111-1111-4111-8111-111111111106",
} as const;

export const SEED_SLOT_IDS = {
  breakfast: "22222222-2222-4222-8222-222222222201",
  lunch: "22222222-2222-4222-8222-222222222202",
  dinner: "22222222-2222-4222-8222-222222222203",
  snack: "22222222-2222-4222-8222-222222222204",
} as const;

/** Lucide name + design token for each seeded category (ADR-002 §3). */
export const CATEGORY_VISUALS_BY_ID: Record<
  string,
  { icon: string; accent: string }
> = {
  [SEED_CATEGORY_IDS.produce]: {
    icon: "Leaf",
    accent: "--color-success",
  },
  [SEED_CATEGORY_IDS.meatFish]: {
    icon: "Beef",
    accent: "--color-error",
  },
  [SEED_CATEGORY_IDS.dairyEggs]: {
    icon: "Milk",
    accent: "--color-info",
  },
  [SEED_CATEGORY_IDS.dryGoods]: {
    icon: "Wheat",
    accent: "--color-warning",
  },
  [SEED_CATEGORY_IDS.oilsCondiments]: {
    icon: "Droplets",
    accent: "--color-accent",
  },
  [SEED_CATEGORY_IDS.other]: {
    icon: "Circle",
    accent: "--color-muted",
  },
};

export const STARTER_CATEGORIES: IngredientCategory[] = [
  {
    id: SEED_CATEGORY_IDS.produce,
    name: "Produce",
    sortOrder: 10,
    ...CATEGORY_VISUALS_BY_ID[SEED_CATEGORY_IDS.produce]!,
  },
  {
    id: SEED_CATEGORY_IDS.meatFish,
    name: "Meat & fish",
    sortOrder: 20,
    ...CATEGORY_VISUALS_BY_ID[SEED_CATEGORY_IDS.meatFish]!,
  },
  {
    id: SEED_CATEGORY_IDS.dairyEggs,
    name: "Dairy & eggs",
    sortOrder: 30,
    ...CATEGORY_VISUALS_BY_ID[SEED_CATEGORY_IDS.dairyEggs]!,
  },
  {
    id: SEED_CATEGORY_IDS.dryGoods,
    name: "Dry goods",
    sortOrder: 40,
    ...CATEGORY_VISUALS_BY_ID[SEED_CATEGORY_IDS.dryGoods]!,
  },
  {
    id: SEED_CATEGORY_IDS.oilsCondiments,
    name: "Oils & condiments",
    sortOrder: 50,
    ...CATEGORY_VISUALS_BY_ID[SEED_CATEGORY_IDS.oilsCondiments]!,
  },
  {
    id: SEED_CATEGORY_IDS.other,
    name: "Other",
    sortOrder: 60,
    ...CATEGORY_VISUALS_BY_ID[SEED_CATEGORY_IDS.other]!,
  },
];

export const DEFAULT_MEAL_SLOTS: MealSlot[] = [
  {
    id: SEED_SLOT_IDS.breakfast,
    name: "Breakfast",
    sortOrder: 10,
    isDefault: true,
  },
  { id: SEED_SLOT_IDS.lunch, name: "Lunch", sortOrder: 20, isDefault: true },
  { id: SEED_SLOT_IDS.dinner, name: "Dinner", sortOrder: 30, isDefault: true },
  { id: SEED_SLOT_IDS.snack, name: "Snack", sortOrder: 40, isDefault: true },
];

export function defaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS };
}

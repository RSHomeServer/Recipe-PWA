import type { SegmentedOption } from "@/ui/segmented-group";

/** ADR-003 §3 — plan/log composer question. */
export const ENTRY_SOURCE_QUESTION = "Where's this coming from?";

export const BATCH_UNAVAILABLE_REASON =
  "No batches yet. Cook a recipe and its portions appear here.";

/** Plan composer options (ADR-003 §3). Order is binding. */
export function planEntryKindOptions(hasAvailableBatches: boolean): SegmentedOption[] {
  return [
    {
      value: "recipeServings",
      label: "Cook a recipe",
      helperText:
        "You'll cook this fresh. Its ingredients go on the shopping list.",
    },
    {
      value: "batchPortions",
      label: "Eat a portion you already cooked",
      helperText:
        "From a batch in the fridge or freezer. Nothing to buy — this food already exists.",
      disabled: !hasAvailableBatches,
      disabledReason: hasAvailableBatches ? undefined : BATCH_UNAVAILABLE_REASON,
    },
    {
      value: "ingredient",
      label: "Eat or heat one item",
      helperText:
        "One thing, straight from the pack: hashbrowns, yoghurt, fruit. Goes on the shopping list.",
    },
  ];
}

/** Log composer — same three labels; helpers reflect logging side effects. */
export function logEntryKindOptions(hasAvailableBatches: boolean): SegmentedOption[] {
  return [
    {
      value: "recipeServings",
      label: "Cook a recipe",
      helperText:
        "Log servings of a recipe as written. Pantry stays unchanged until you cook a batch.",
    },
    {
      value: "batchPortions",
      label: "Eat a portion you already cooked",
      helperText:
        "From a batch in the fridge or freezer. Uses remaining portions — nothing to buy.",
      disabled: !hasAvailableBatches,
      disabledReason: hasAvailableBatches ? undefined : BATCH_UNAVAILABLE_REASON,
    },
    {
      value: "ingredient",
      label: "Eat or heat one item",
      helperText:
        "One thing, straight from the pack. Deducted from your pantry when you log it.",
    },
    {
      value: "customFood",
      label: "Custom food",
      helperText: "Something outside your library — enter its nutrition yourself.",
    },
  ];
}

/** ADR-003 §4 one-line definitions for info popovers. */
export const LEXICON = {
  ingredient:
    "One thing you buy, with its nutrition per 100 g, 100 ml or item.",
  recipe:
    "Ingredients combined into servings. Scale it, cook it, track its portions.",
  batch: "One cooking session, and the portions it produced.",
  portion: "One helping of a batch. Half portions are fine.",
  serving: "One helping of a recipe as written.",
  pantry: "Raw ingredients you have now.",
  planned: "What you intend to eat. Planning changes nothing physical.",
  logged: "What you actually ate.",
} as const;

export const SINGLE_INGREDIENT_RECIPE_WARN =
  "This is a single ingredient. You can plan and log it directly from the ingredient library — you only need a recipe when you are combining things.";

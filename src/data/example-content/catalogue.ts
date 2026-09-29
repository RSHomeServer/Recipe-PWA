import type { MeasureKind, Unit } from "@/domain";

/**
 * Stable example-content IDs (R6.4). Install skips any row whose id already
 * exists — never duplicates, never overwrites user edits.
 */
export const EXAMPLE_MIX_IDS = {
  chilliGarlicVinegar: "e6a11111-1111-4111-8111-000000000001",
  smokyPaprikaRub: "e6a11111-1111-4111-8111-000000000002",
  umamiDust: "e6a11111-1111-4111-8111-000000000003",
  warmSpiceBlend: "e6a11111-1111-4111-8111-000000000004",
  sourHotSplash: "e6a11111-1111-4111-8111-000000000005",
  herbyLemonOregano: "e6a11111-1111-4111-8111-000000000006",
} as const;

export const EXAMPLE_SNACK_IDS = {
  chilliGarlicCucumber: "e6a22222-2222-4222-8222-000000000001",
  yogurtWithPaprika: "e6a22222-2222-4222-8222-000000000002",
  cherryTomatoCapers: "e6a22222-2222-4222-8222-000000000003",
  pepperWithSplash: "e6a22222-2222-4222-8222-000000000004",
} as const;

/** Pack ingredient refs: `datasetId::entryCode` (R6.3). */
export type PackIngredientRef = `${string}::${string}`;

export type ExampleMixLineDef = {
  id: string;
  ref: PackIngredientRef;
  quantity: { amount: number; kind: MeasureKind };
  displayUnit: Unit;
  entryHint: { spoons: number; spoon: "tsp" | "tbsp" } | null;
};

export type ExampleMixDef = {
  id: string;
  name: string;
  servings: number;
  notes: string | null;
  lines: ExampleMixLineDef[];
};

export type ExampleSnackDef = {
  id: string;
  name: string;
  mixId: string;
  mixServings: number;
  baseComponentId: string;
  mixComponentId: string;
  base: {
    ref: PackIngredientRef;
    quantity: { value: number; unit: Unit };
  };
};

/** ~6 example mixes — Flavour Lab ideas, pack ingredients only. */
export const EXAMPLE_MIXES: ExampleMixDef[] = [
  {
    id: EXAMPLE_MIX_IDS.chilliGarlicVinegar,
    name: "Chilli Garlic Vinegar",
    servings: 3,
    notes:
      "Example mix from Settings. Shake over cucumber or greens. One serving ≈ a third of the batch.",
    lines: [
      {
        id: "e6a33333-3333-4333-8333-000000000001",
        ref: "usda-sr-legacy::173469", // Cider vinegar
        quantity: { amount: 30, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000002",
        ref: "cofid-2021::13-830", // Garlic powder
        quantity: { amount: 2, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000003",
        ref: "usda-sr-legacy::171319", // Chilli powder
        quantity: { amount: 1, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000004",
        ref: "usda-branded::2449440", // MSG
        quantity: { amount: 1, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000005",
        ref: "cofid-2021::17-367", // Salt
        quantity: { amount: 0.5, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
    ],
  },
  {
    id: EXAMPLE_MIX_IDS.smokyPaprikaRub,
    name: "Smoky Paprika Rub",
    servings: 4,
    notes: "Example mix from Settings. Dry rub for veg, yogurt, or eggs.",
    lines: [
      {
        id: "e6a33333-3333-4333-8333-000000000011",
        ref: "usda-sr-legacy::171329", // Paprika (also smoked paprika alias)
        quantity: { amount: 4.6, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 2, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000012",
        ref: "usda-sr-legacy::170923", // Cumin
        quantity: { amount: 2.1, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 1, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000013",
        ref: "usda-sr-legacy::171328", // Oregano
        quantity: { amount: 1.8, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 1, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000014",
        ref: "usda-sr-legacy::171327", // Onion powder
        quantity: { amount: 2.4, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 1, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000015",
        ref: "usda-sr-legacy::170931", // Black pepper
        quantity: { amount: 1.15, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 0.5, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000016",
        ref: "cofid-2021::17-367", // Salt
        quantity: { amount: 1, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
    ],
  },
  {
    id: EXAMPLE_MIX_IDS.umamiDust,
    name: "Umami Dust",
    servings: 6,
    notes: "Example mix from Settings. Sprinkle lightly — MSG is potent.",
    lines: [
      {
        id: "e6a33333-3333-4333-8333-000000000021",
        ref: "usda-branded::2273557", // Nutritional yeast
        quantity: { amount: 6, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000022",
        ref: "usda-branded::2449440", // MSG
        quantity: { amount: 1, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000023",
        ref: "usda-sr-legacy::171327", // Onion powder
        quantity: { amount: 2.4, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 1, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000024",
        ref: "cofid-2021::13-830", // Garlic powder
        quantity: { amount: 2, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
    ],
  },
  {
    id: EXAMPLE_MIX_IDS.warmSpiceBlend,
    name: "Warm Spice Blend",
    servings: 4,
    notes: "Example mix from Settings. Cumin, turmeric, cinnamon, pepper.",
    lines: [
      {
        id: "e6a33333-3333-4333-8333-000000000031",
        ref: "usda-sr-legacy::170923", // Cumin
        quantity: { amount: 4.2, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 2, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000032",
        ref: "usda-sr-legacy::172231", // Turmeric
        quantity: { amount: 3, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 1, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000033",
        ref: "usda-sr-legacy::171320", // Cinnamon
        quantity: { amount: 2.6, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 1, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000034",
        ref: "usda-sr-legacy::170931", // Black pepper
        quantity: { amount: 1.15, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 0.5, spoon: "tsp" },
      },
    ],
  },
  {
    id: EXAMPLE_MIX_IDS.sourHotSplash,
    name: "Sour Hot Splash",
    servings: 3,
    notes: "Example mix from Settings. Sharp vinegar + hot sauce.",
    lines: [
      {
        id: "e6a33333-3333-4333-8333-000000000041",
        ref: "usda-sr-legacy::173469", // Cider vinegar
        quantity: { amount: 25, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000042",
        ref: "usda-sr-legacy::174527", // Hot pepper sauce
        quantity: { amount: 9.4, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 2, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000043",
        ref: "cofid-2021::13-830", // Garlic powder
        quantity: { amount: 1, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000044",
        ref: "cofid-2021::17-367", // Salt
        quantity: { amount: 0.5, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
    ],
  },
  {
    id: EXAMPLE_MIX_IDS.herbyLemonOregano,
    name: "Herby Lemon Oregano",
    servings: 4,
    notes: "Example mix from Settings. Bright herb dressing for veg.",
    lines: [
      {
        id: "e6a33333-3333-4333-8333-000000000051",
        ref: "usda-sr-legacy::167748", // Lemon juice, bottled
        quantity: { amount: 20, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
      {
        id: "e6a33333-3333-4333-8333-000000000052",
        ref: "usda-sr-legacy::171328", // Oregano
        quantity: { amount: 1.8, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 1, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000053",
        ref: "usda-sr-legacy::172234", // Yellow mustard
        quantity: { amount: 5, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 1, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000054",
        ref: "usda-sr-legacy::170931", // Black pepper
        quantity: { amount: 1.15, kind: "mass" },
        displayUnit: "g",
        entryHint: { spoons: 0.5, spoon: "tsp" },
      },
      {
        id: "e6a33333-3333-4333-8333-000000000055",
        ref: "cofid-2021::17-367", // Salt
        quantity: { amount: 0.5, kind: "mass" },
        displayUnit: "g",
        entryHint: null,
      },
    ],
  },
];

/** ~4 example snacks — base ingredient + mix servings (ADR-010). */
export const EXAMPLE_SNACKS: ExampleSnackDef[] = [
  {
    id: EXAMPLE_SNACK_IDS.chilliGarlicCucumber,
    name: "Chilli Garlic Cucumber",
    mixId: EXAMPLE_MIX_IDS.chilliGarlicVinegar,
    mixServings: 1,
    baseComponentId: "e6a44444-4444-4444-8444-000000000001",
    mixComponentId: "e6a44444-4444-4444-8444-000000000002",
    base: {
      ref: "cofid-2021::13-523", // Cucumber, raw, flesh and skin
      quantity: { value: 200, unit: "g" },
    },
  },
  {
    id: EXAMPLE_SNACK_IDS.yogurtWithPaprika,
    name: "Yogurt with Smoky Paprika",
    mixId: EXAMPLE_MIX_IDS.smokyPaprikaRub,
    mixServings: 1,
    baseComponentId: "e6a44444-4444-4444-8444-000000000011",
    mixComponentId: "e6a44444-4444-4444-8444-000000000012",
    base: {
      ref: "cofid-2021::12-379", // Yogurt, low fat, plain
      quantity: { value: 150, unit: "g" },
    },
  },
  {
    id: EXAMPLE_SNACK_IDS.cherryTomatoCapers,
    name: "Cherry Tomatoes with Herby Lemon",
    mixId: EXAMPLE_MIX_IDS.herbyLemonOregano,
    mixServings: 1,
    baseComponentId: "e6a44444-4444-4444-8444-000000000021",
    mixComponentId: "e6a44444-4444-4444-8444-000000000022",
    base: {
      ref: "cofid-2021::13-519", // Tomatoes, cherry, raw
      quantity: { value: 150, unit: "g" },
    },
  },
  {
    id: EXAMPLE_SNACK_IDS.pepperWithSplash,
    name: "Red Pepper with Sour Hot Splash",
    mixId: EXAMPLE_MIX_IDS.sourHotSplash,
    mixServings: 1,
    baseComponentId: "e6a44444-4444-4444-8444-000000000031",
    mixComponentId: "e6a44444-4444-4444-8444-000000000032",
    base: {
      ref: "cofid-2021::13-524", // Pepper, capsicum, red, raw
      quantity: { value: 120, unit: "g" },
    },
  },
];

/** Every pack ref used by examples — for build/test integrity. */
export function allExamplePackRefs(): PackIngredientRef[] {
  const refs = new Set<PackIngredientRef>();
  for (const mix of EXAMPLE_MIXES) {
    for (const line of mix.lines) refs.add(line.ref);
  }
  for (const snack of EXAMPLE_SNACKS) {
    refs.add(snack.base.ref);
  }
  return [...refs].sort();
}

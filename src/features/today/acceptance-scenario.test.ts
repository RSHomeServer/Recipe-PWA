import { describe, expect, it } from "vitest";
import {
  MealTemplateSchema,
  expandTemplateToPlannedMeals,
  requirements,
  shoppingList,
  type Ingredient,
  type MealTemplate,
  type PantryStock,
} from "@/domain";

/**
 * V2 headline acceptance scenario (V2_SCOPE.md, ticket 10).
 *
 * From a fresh install the four starter ingredients — chicken thighs,
 * hashbrowns, peas and BBQ sauce — are planned for four dinners as one saved
 * meal, and the shopping list then shows the correct four-day aggregate minus
 * whatever is in the pantry, without any nutrition typed by hand.
 *
 * This guards the "shopping matched" half of the scenario at the domain level
 * so it cannot silently regress. The interaction-count and timing half is
 * recorded in docs/planning/UX_CRITIQUE_V2.md from a UI walk.
 */

function ingredient(
  id: string,
  name: string,
  measureKind: "mass" | "volume",
): Ingredient {
  return {
    id,
    name,
    categoryId: null,
    measureKind,
    nutrition: { kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 },
    notes: null,
    source: {
      kind: "reference",
      datasetId: "cofid-2021",
      datasetName: "McCance and Widdowson's CoFID",
      entryCode: id.slice(0, 6),
      entryName: name,
      licence: "OGL-UK-UNCONFIRMED",
      url: "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
      retrievedAt: "2026-09-24",
      note: null,
    },
    imageId: null,
    common: true,
    archivedAt: null,
  };
}

const chicken = ingredient(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "Chicken thigh, raw",
  "mass",
);
const hashbrowns = ingredient(
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "Hash browns, frozen",
  "mass",
);
const peas = ingredient(
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "Peas, frozen",
  "mass",
);
const bbq = ingredient(
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "Barbecue sauce",
  "volume",
);

const ctx = {
  recipesById: new Map(),
  ingredientsById: new Map<string, Ingredient>([
    [chicken.id, chicken],
    [hashbrowns.id, hashbrowns],
    [peas.id, peas],
    [bbq.id, bbq],
  ]),
};

const slotId = "22222222-2222-4222-8222-2222222222d0";

// Per-day quantities for one dinner.
const PER_DAY = {
  chicken: 300, // g
  hashbrowns: 200, // g
  peas: 150, // g
  bbq: 30, // ml
};

function dinnerTemplate(): MealTemplate {
  return MealTemplateSchema.parse({
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    name: "BBQ chicken dinner",
    components: [
      {
        id: "a1111111-1111-4111-8111-111111111111",
        entry: {
          kind: "ingredient",
          ingredientId: chicken.id,
          quantity: { value: PER_DAY.chicken, unit: "g" },
        },
        note: null,
      },
      {
        id: "a2222222-2222-4222-8222-222222222222",
        entry: {
          kind: "ingredient",
          ingredientId: hashbrowns.id,
          quantity: { value: PER_DAY.hashbrowns, unit: "g" },
        },
        note: null,
      },
      {
        id: "a3333333-3333-4333-8333-333333333333",
        entry: {
          kind: "ingredient",
          ingredientId: peas.id,
          quantity: { value: PER_DAY.peas, unit: "g" },
        },
        note: null,
      },
      {
        id: "a4444444-4444-4444-8444-444444444444",
        entry: {
          kind: "ingredient",
          ingredientId: bbq.id,
          quantity: { value: PER_DAY.bbq, unit: "ml" },
        },
        note: null,
      },
    ],
    defaultSlotId: slotId,
    createdAt: "2026-09-24T12:00:00.000Z",
    updatedAt: "2026-09-24T12:00:00.000Z",
    archivedAt: null,
  });
}

let idSeq = 0;
function nextId() {
  idSeq += 1;
  return `00000000-0000-4000-8000-${idSeq.toString(16).padStart(12, "0")}`;
}

const DINNERS = [
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
] as const;

describe("V2 headline acceptance scenario — shopping aggregate", () => {
  it("plans four dinners from one meal and buys the four-day total minus pantry", () => {
    idSeq = 0;
    const template = dinnerTemplate();

    // Apply the saved meal to four days at once (R4.4/R4.5).
    const planned = expandTemplateToPlannedMeals({
      template,
      dates: DINNERS,
      slotId,
      existing: [],
      nextId,
    });

    // 4 components × 4 days → 16 rows in 4 day-groups.
    expect(planned).toHaveLength(16);
    expect(new Set(planned.map((m) => m.group!.id)).size).toBe(4);

    // Pantry already holds some of each (BBQ fully covered).
    const pantry: PantryStock[] = [
      {
        ingredientId: chicken.id,
        quantity: { amount: 500, kind: "mass" },
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
      {
        ingredientId: peas.id,
        quantity: { amount: 250, kind: "mass" },
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
      {
        ingredientId: bbq.id,
        quantity: { amount: 500, kind: "volume" },
        updatedAt: "2026-09-24T00:00:00.000Z",
      },
    ];

    const lines = requirements(
      planned,
      { from: DINNERS[0], to: DINNERS[3] },
      ctx,
    );

    // Requirements are the four-day aggregate, per ingredient.
    const requiredById = new Map(lines.map((l) => [l.ingredientId, l.quantity]));
    expect(requiredById.get(chicken.id)).toEqual({
      amount: PER_DAY.chicken * 4,
      kind: "mass",
    });
    expect(requiredById.get(hashbrowns.id)).toEqual({
      amount: PER_DAY.hashbrowns * 4,
      kind: "mass",
    });
    expect(requiredById.get(peas.id)).toEqual({
      amount: PER_DAY.peas * 4,
      kind: "mass",
    });
    expect(requiredById.get(bbq.id)).toEqual({
      amount: PER_DAY.bbq * 4,
      kind: "volume",
    });

    const shopping = shoppingList(lines, pantry, null);
    const toBuyById = new Map(shopping.map((l) => [l.ingredientId, l.toBuy]));

    // chicken: 1200 − 500 = 700 g
    expect(toBuyById.get(chicken.id)).toEqual({ amount: 700, kind: "mass" });
    // hashbrowns: 800 − 0 = 800 g
    expect(toBuyById.get(hashbrowns.id)).toEqual({ amount: 800, kind: "mass" });
    // peas: 600 − 250 = 350 g
    expect(toBuyById.get(peas.id)).toEqual({ amount: 350, kind: "mass" });
    // BBQ: 120 − 500 → fully covered, dropped from the list.
    expect(toBuyById.has(bbq.id)).toBe(false);
    expect(shopping).toHaveLength(3);
  });
});

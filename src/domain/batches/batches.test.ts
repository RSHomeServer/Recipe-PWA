import { describe, expect, it } from "vitest";
import {
  createSnapshot,
  nutritionOf,
  seedActualLines,
  sum,
} from "../nutrition";
import type { Ingredient } from "../ingredients/schemas";
import type { LoggedMeal } from "../logging/schemas";
import type { Recipe } from "../recipes/schemas";
import {
  closeBatch,
  isBatchAvailable,
  planCookBatch,
  portionsConsumed,
  portionsRemaining,
  portionsRemainingDisplay,
  shortfallsForActualLines,
} from "./index";

const now = "2026-09-22T12:00:00.000Z";

const chicken: Ingredient = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Chicken",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 120, proteinG: 23, carbsG: 0, fatG: 2.6, sodiumMg: null },
  notes: null,
  source: {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note: null,
  },
  imageId: null,
  common: true,
  gramsPerTsp: null,
  gramsPerTbsp: null,
  flavourTags: [],
  archivedAt: null,
};

const rice: Ingredient = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Rice",
  categoryId: null,
  measureKind: "mass",
  nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, sodiumMg: null },
  notes: null,
  source: {
    kind: "userEntered",
    datasetId: null,
    datasetName: null,
    entryCode: null,
    entryName: null,
    licence: null,
    url: null,
    retrievedAt: null,
    note: null,
  },
  imageId: null,
  common: true,
  gramsPerTsp: null,
  gramsPerTbsp: null,
  flavourTags: [],
  archivedAt: null,
};

const recipe: Recipe = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Chicken bowl",
  servings: 2,
  lines: [
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ingredientId: chicken.id,
      quantity: { amount: 500, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    entryHint: null,
    },
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      ingredientId: rice.id,
      quantity: { amount: 300, kind: "mass" },
      displayUnit: "g",
      optional: false,
      note: null,
    entryHint: null,
    },
  ],
  steps: ["Cook"],
  tags: [],
  imageId: null,
  notes: null,
  createdAt: now,
  updatedAt: now,
  kind: "dish",
  archivedAt: null,
};

const ingredientsById = new Map<string, Ingredient>([
  [chicken.id, chicken],
  [rice.id, rice],
]);

describe("planCookBatch", () => {
  it("freezes edited actuals (500→550) into the snapshot and deducts those amounts", () => {
    const seeded = seedActualLines(recipe, 1);
    const actual = seeded.map((line) =>
      line.ingredientId === chicken.id
        ? { ...line, quantity: { amount: 550, kind: "mass" as const } }
        : line,
    );

    const stockById = new Map([
      [
        chicken.id,
        {
          ingredientId: chicken.id,
          quantity: { amount: 2000, kind: "mass" as const },
          updatedAt: now,
        },
      ],
      [
        rice.id,
        {
          ingredientId: rice.id,
          quantity: { amount: 1000, kind: "mass" as const },
          updatedAt: now,
        },
      ],
    ]);

    const { batch, shortfalls, pantryAfter } = planCookBatch(
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        recipe,
        ingredientsById,
        scale: 1,
        portionsNominal: 4,
        actualLines: actual,
        cookedAt: now,
        label: "Sunday",
        notes: null,
      },
      stockById,
    );

    expect(shortfalls).toEqual([]);
    const chickenLine = batch.snapshot.lines.find(
      (line) => line.ingredientId === chicken.id,
    );
    expect(chickenLine?.quantity.amount).toBe(550);
    expect(chickenLine?.nutrition).toEqual(
      nutritionOf(chicken, { amount: 550, kind: "mass" }),
    );
    expect(batch.snapshot.total).toEqual(
      sum(batch.snapshot.lines.map((line) => line.nutrition)),
    );

    const chickenStock = pantryAfter.find((row) => row.ingredientId === chicken.id);
    const riceStock = pantryAfter.find((row) => row.ingredientId === rice.id);
    expect(chickenStock?.quantity.amount).toBe(1450);
    expect(riceStock?.quantity.amount).toBe(700);
  });

  it("reports shortfalls but still plans cook-anyway deductions into negatives", () => {
    const actual = seedActualLines(recipe, 1);
    const stockById = new Map([
      [
        chicken.id,
        {
          ingredientId: chicken.id,
          quantity: { amount: 100, kind: "mass" as const },
          updatedAt: now,
        },
      ],
    ]);

    const shortfalls = shortfallsForActualLines(
      actual,
      stockById,
      ingredientsById,
    );
    expect(shortfalls.length).toBeGreaterThan(0);

    const { pantryAfter, shortfalls: plannedShortfalls } = planCookBatch(
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        recipe,
        ingredientsById,
        scale: 1,
        portionsNominal: 4,
        actualLines: actual,
        cookedAt: now,
        label: null,
        notes: null,
      },
      stockById,
    );

    expect(plannedShortfalls.length).toBeGreaterThan(0);
    const chickenStock = pantryAfter.find((row) => row.ingredientId === chicken.id);
    expect(chickenStock?.quantity.amount).toBe(100 - 500);
    const riceStock = pantryAfter.find((row) => row.ingredientId === rice.id);
    expect(riceStock?.quantity.amount).toBe(-300);
  });
});

describe("portions + close", () => {
  const batchBase = planCookBatch(
    {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      recipe,
      ingredientsById,
      scale: 1,
      portionsNominal: 4,
      actualLines: seedActualLines(recipe, 1),
      cookedAt: now,
      label: null,
      notes: null,
    },
    new Map(),
  ).batch;

  it("derives remaining from batchPortions logs", () => {
    const logs: LoggedMeal[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        date: "2026-09-22",
        slotId: "22222222-2222-4222-8222-222222222201",
        entry: {
          kind: "batchPortions",
          batchId: batchBase.id,
          portions: 1.5,
        },
        plannedMealId: null,
        loggedAt: now,
        note: null,
        group: null,
      },
    ];

    expect(portionsConsumed(batchBase.id, logs)).toBe(1.5);
    expect(portionsRemaining(batchBase, logs)).toBe(2.5);
    expect(portionsRemainingDisplay(batchBase, logs)).toBe(2.5);
    expect(isBatchAvailable(batchBase, logs)).toBe(true);
  });

  it("treats closedAt as unavailable even with remaining portions", () => {
    const closed = closeBatch(batchBase, now);
    expect(closed.snapshot).toEqual(batchBase.snapshot);
    expect(isBatchAvailable(closed, [])).toBe(false);
    expect(portionsRemaining(closed, [])).toBe(4);
  });

  it("exhaustion via remaining≈0 does not require closedAt", () => {
    const logs: LoggedMeal[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        date: "2026-09-22",
        slotId: "22222222-2222-4222-8222-222222222201",
        entry: {
          kind: "batchPortions",
          batchId: batchBase.id,
          portions: 4,
        },
        plannedMealId: null,
        loggedAt: now,
        note: null,
        group: null,
      },
    ];
    expect(batchBase.closedAt).toBeNull();
    expect(isBatchAvailable(batchBase, logs)).toBe(false);
    expect(portionsRemainingDisplay(batchBase, logs)).toBe(0);
  });
});

describe("history immutability of createSnapshot", () => {
  it("keeps prior snapshot byte-identical after ingredient nutrition edits", () => {
    const byId = Object.fromEntries(ingredientsById);
    const snapshot = createSnapshot(recipe, byId, seedActualLines(recipe, 1));
    const frozen = structuredClone(snapshot);

    const editedChicken: Ingredient = {
      ...chicken,
      nutrition: { kcal: 999, proteinG: 1, carbsG: 1, fatG: 1, sodiumMg: null },
    };
    const nextById = { ...byId, [chicken.id]: editedChicken };
    const future = createSnapshot(recipe, nextById, seedActualLines(recipe, 1));

    expect(snapshot).toEqual(frozen);
    expect(future.total.kcal).not.toBe(snapshot.total.kcal);
  });
});

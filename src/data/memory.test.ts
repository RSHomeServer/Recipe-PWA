import { describe, expect, it } from "vitest";
import {
  BatchSchema,
  IngredientSchema,
  PlannedMealSchema,
  SettingsSchema,
} from "@/domain";
import { createMemoryRepositories } from "./repos/memory";
import { SnapshotImmutabilityError } from "./repos/snapshot-guard";

const now = () => new Date().toISOString();
const ingredientId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recipeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const batchId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("in-memory repositories", () => {
  it("enforces snapshot immutability like the Dexie impl", async () => {
    const repos = createMemoryRepositories();
    const batch = BatchSchema.parse({
      id: batchId,
      recipeId,
      scale: 1,
      portionsNominal: 2,
      cookedAt: now(),
      label: null,
      closedAt: null,
      notes: null,
      snapshot: {
        recipeName: "X",
        lines: [],
        total: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      },
    });

    await repos.batches.create(batch);
    await expect(
      repos.batches.put({
        ...batch,
        snapshot: { ...batch.snapshot, recipeName: "Y" },
      }),
    ).rejects.toBeInstanceOf(SnapshotImmutabilityError);
  });

  it("round-trips ingredient and settings", async () => {
    const repos = createMemoryRepositories();
    const ingredient = IngredientSchema.parse({
      id: ingredientId,
      name: "Rice",
      categoryId: null,
      measureKind: "mass",
      nutrition: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 },
      notes: null,
      archivedAt: null,
    });
    await repos.ingredients.put(ingredient);
    expect(await repos.ingredients.byId(ingredientId)).toEqual(ingredient);

    const settings = SettingsSchema.parse({
      id: "singleton",
      dailyCalorieTarget: 2000,
      weekStartsOn: 1,
      themePreference: "light",
    });
    await repos.settings.put(settings);
    expect(await repos.settings.get()).toEqual(settings);
  });

  it("rejects customFood on planned meals via schema", () => {
    expect(() =>
      PlannedMealSchema.parse({
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        date: "2026-09-22",
        slotId: "22222222-2222-4222-8222-222222222201",
        entry: {
          kind: "customFood",
          food: {
            name: "Takeaway",
            quantity: 1,
            nutrition: { kcal: 800, proteinG: 20, carbsG: 80, fatG: 40 },
          },
        },
        position: 0,
        note: null,
      }),
    ).toThrow();
  });
});

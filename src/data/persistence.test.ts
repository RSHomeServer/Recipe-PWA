import { afterEach, describe, expect, it } from "vitest";
import {
  BatchSchema,
  IngredientSchema,
  type Batch,
  type Ingredient,
  type Recipe,
  type RecipeImage,
} from "@/domain";
import {
  BackupSchemaTooNewError,
  BackupValidationError,
  ParseOnReadError,
  SnapshotImmutabilityError,
  createDexieRepositories,
  deleteRecipeDb,
  exportBackup,
  importBackup,
  openRecipeDb,
  recipeDbName,
  SEED_SLOT_IDS,
} from "./index";

const now = () => new Date().toISOString();

function testDbName(suffix: string): string {
  return recipeDbName(`t${suffix.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`);
}

const ingredientId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recipeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const batchId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const imageId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function sampleIngredient(): Ingredient {
  return IngredientSchema.parse({
    id: ingredientId,
    name: "Chicken",
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
    notes: null,
    archivedAt: null,
  });
}

function sampleRecipe(): Recipe {
  return {
    id: recipeId,
    name: "Chicken bowl",
    servings: 2,
    lines: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        ingredientId,
        quantity: { amount: 500, kind: "mass" },
        displayUnit: "g",
        optional: false,
        note: null,
      },
    ],
    steps: ["Cook chicken"],
    tags: ["high-protein"],
    imageId: null,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
    archivedAt: null,
  };
}

function sampleBatch(): Batch {
  return BatchSchema.parse({
    id: batchId,
    recipeId,
    scale: 1,
    portionsNominal: 4,
    cookedAt: now(),
    label: "Sunday",
    closedAt: null,
    notes: null,
    snapshot: {
      recipeName: "Chicken bowl",
      lines: [
        {
          ingredientId,
          ingredientName: "Chicken",
          quantity: { amount: 500, kind: "mass" },
          nutrition: { kcal: 825, proteinG: 155, carbsG: 0, fatG: 18 },
        },
      ],
      total: { kcal: 825, proteinG: 155, carbsG: 0, fatG: 18 },
    },
  });
}

describe("Dexie repositories", () => {
  const names: string[] = [];

  afterEach(async () => {
    for (const name of names.splice(0)) {
      await deleteRecipeDb(name);
    }
  });

  async function openFresh() {
    const name = testDbName(`${Date.now()}${Math.random()}`);
    names.push(name);
    const db = await openRecipeDb({ name, ephemeral: true });
    return { db, repos: createDexieRepositories(db), name };
  }

  it("seeds meal slots, categories, and settings on open", async () => {
    const { repos } = await openFresh();
    const slots = await repos.mealSlots.all();
    const categories = await repos.ingredientCategories.all();
    const settings = await repos.settings.get();

    expect(slots).toHaveLength(4);
    expect(slots.map((s) => s.id)).toContain(SEED_SLOT_IDS.breakfast);
    expect(categories.length).toBeGreaterThanOrEqual(4);
    expect(settings.id).toBe("singleton");
    expect(settings.weekStartsOn).toBe(1);
  });

  it("round-trips core entities through parse-on-read", async () => {
    const { repos } = await openFresh();
    const ingredient = sampleIngredient();
    const recipe = sampleRecipe();
    const batch = sampleBatch();

    await repos.ingredients.put(ingredient);
    await repos.recipes.put(recipe);
    await repos.batches.create(batch);
    await repos.pantryStock.put({
      ingredientId,
      quantity: { amount: 1200, kind: "mass" },
      updatedAt: now(),
    });

    expect(await repos.ingredients.byId(ingredientId)).toEqual(ingredient);
    expect(await repos.recipes.byId(recipeId)).toMatchObject({
      name: "Chicken bowl",
    });
    expect(await repos.batches.byId(batchId)).toEqual(batch);
    expect(
      (await repos.pantryStock.byIngredientId(ingredientId))?.quantity,
    ).toEqual({ amount: 1200, kind: "mass" });
  });

  it("rejects malformed rows on read", async () => {
    const { db, repos } = await openFresh();
    await db.table("ingredients").put({
      id: ingredientId,
      name: "Broken",
      // missing required fields
    });

    await expect(repos.ingredients.byId(ingredientId)).rejects.toBeInstanceOf(
      ParseOnReadError,
    );
  });

  it("rejects batch snapshot mutation on put and update", async () => {
    const { repos } = await openFresh();
    const batch = sampleBatch();
    await repos.batches.create(batch);

    await expect(
      repos.batches.put({
        ...batch,
        snapshot: {
          ...batch.snapshot,
          recipeName: "Tampered",
        },
      }),
    ).rejects.toBeInstanceOf(SnapshotImmutabilityError);

    await expect(
      repos.batches.update(batchId, {
        label: "ok",
        // @ts-expect-error intentional illegal field
        snapshot: batch.snapshot,
      }),
    ).rejects.toThrow(/snapshot/);

    await repos.batches.update(batchId, { label: "Monday prep" });
    expect((await repos.batches.byId(batchId))?.label).toBe("Monday prep");
    expect((await repos.batches.byId(batchId))?.snapshot).toEqual(
      batch.snapshot,
    );
  });
});

describe("JSON backup V1", () => {
  const names: string[] = [];

  afterEach(async () => {
    for (const name of names.splice(0)) {
      await deleteRecipeDb(name);
    }
  });

  async function openFresh() {
    const name = testDbName(`b${Date.now()}${Math.random()}`);
    names.push(name);
    const db = await openRecipeDb({ name, ephemeral: true });
    return { db, repos: createDexieRepositories(db), name };
  }

  it("export → import round-trips including recipe image Blobs", async () => {
    const { db, repos } = await openFresh();
    const ingredient = sampleIngredient();
    const image: RecipeImage = {
      id: imageId,
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
      width: 8,
      height: 8,
    };
    const recipe = { ...sampleRecipe(), imageId };

    await repos.ingredients.put(ingredient);
    await repos.recipeImages.put(image);
    await repos.recipes.put(recipe);
    const batch = sampleBatch();
    await repos.batches.create(batch);

    const backup = await exportBackup(db);
    expect(backup.formatVersion).toBe(1);
    expect(backup.schemaVersion).toBe(1);
    expect(backup.data.recipeImages[0]).toMatchObject({
      id: imageId,
      mimeType: "image/png",
    });
    expect(
      typeof (backup.data.recipeImages[0] as { blobBase64: string }).blobBase64,
    ).toBe("string");

    // Mutate DB then replace via import
    await repos.ingredients.put({ ...ingredient, name: "Changed" });
    await importBackup(db, backup);

    expect((await repos.ingredients.byId(ingredientId))?.name).toBe("Chicken");
    const restored = await repos.recipeImages.byId(imageId);
    expect(restored?.width).toBe(8);
    expect(restored?.blob.type).toBe("image/png");
    expect(await restored!.blob.arrayBuffer()).toEqual(
      await image.blob.arrayBuffer(),
    );
    expect(await repos.batches.byId(batchId)).toEqual(batch);
  });

  it("refuses newer schemaVersion and writes nothing on invalid payload", async () => {
    const { db, repos } = await openFresh();
    await repos.ingredients.put(sampleIngredient());

    const good = await exportBackup(db);

    await expect(
      importBackup(db, { ...good, schemaVersion: 99 }),
    ).rejects.toBeInstanceOf(BackupSchemaTooNewError);

    expect((await repos.ingredients.byId(ingredientId))?.name).toBe("Chicken");

    await expect(
      importBackup(db, {
        ...good,
        data: {
          ...good.data,
          ingredients: [{ id: ingredientId, name: "nope" }],
        },
      }),
    ).rejects.toBeInstanceOf(BackupValidationError);

    // Invalid import must not clear existing data
    expect((await repos.ingredients.byId(ingredientId))?.name).toBe("Chicken");
    expect(await repos.mealSlots.all()).toHaveLength(4);
  });
});

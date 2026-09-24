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

  it("seeds meal slots, categories, settings, and starter pack on open", async () => {
    const { repos, db } = await openFresh();
    const slots = await repos.mealSlots.all();
    const categories = await repos.ingredientCategories.all();
    const settings = await repos.settings.get();
    const ingredients = await repos.ingredients.all();

    expect(slots).toHaveLength(4);
    expect(slots.map((s) => s.id)).toContain(SEED_SLOT_IDS.breakfast);
    expect(categories.length).toBeGreaterThanOrEqual(4);
    expect(settings.id).toBe("singleton");
    expect(settings.weekStartsOn).toBe(1);
    expect(settings.starterPackVersion).toBeTruthy();
    expect(ingredients.length).toBeGreaterThan(500);
    expect(
      ingredients.some((ingredient) => ingredient.common),
    ).toBe(true);
    expect(await db.table("ingredients").count()).toBe(ingredients.length);
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

  it("cook plan with edited actuals persists snapshot and pantry deduction", async () => {
    const { repos } = await openFresh();
    const ingredient = sampleIngredient();
    const recipe = sampleRecipe();
    await repos.ingredients.put(ingredient);
    await repos.recipes.put(recipe);
    await repos.pantryStock.put({
      ingredientId,
      quantity: { amount: 2000, kind: "mass" },
      updatedAt: now(),
    });

    const { planCookBatch, seedActualLines } = await import("@/domain");
    const seeded = seedActualLines(recipe, 1);
    const actual = seeded.map((line) =>
      line.ingredientId === ingredientId
        ? { ...line, quantity: { amount: 550, kind: "mass" as const } }
        : line,
    );
    const stock = await repos.pantryStock.all();
    const plan = planCookBatch(
      {
        id: batchId,
        recipe,
        ingredientsById: new Map([[ingredientId, ingredient]]),
        scale: 1,
        portionsNominal: 4,
        actualLines: actual,
        cookedAt: now(),
        label: "Edited cook",
        notes: null,
      },
      new Map(stock.map((row) => [row.ingredientId, row])),
    );

    await repos.batches.create(plan.batch);
    for (const row of plan.pantryAfter) {
      await repos.pantryStock.put(row);
    }

    const stored = await repos.batches.byId(batchId);
    expect(stored?.snapshot.lines[0]?.quantity.amount).toBe(550);
    expect(
      (await repos.pantryStock.byIngredientId(ingredientId))?.quantity.amount,
    ).toBe(1450);

    await repos.ingredients.put({
      ...ingredient,
      nutrition: { kcal: 999, proteinG: 1, carbsG: 1, fatG: 1 },
    });
    expect((await repos.batches.byId(batchId))?.snapshot).toEqual(
      stored?.snapshot,
    );
  });
});

describe("JSON backup (format v1, schemaVersion tracks Dexie)", () => {
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
    expect(backup.schemaVersion).toBe(2);
    expect(backup.data.mealTemplates).toEqual([]);
    expect(backup.data.recipeImages[0]).toMatchObject({
      id: imageId,
      mimeType: "image/png",
    });
    expect(
      typeof (backup.data.recipeImages[0] as { blobBase64: string }).blobBase64,
    ).toBe("string");

    await repos.ingredients.put({ ...ingredient, name: "Changed" });
    await importBackup(db, backup);

    expect((await repos.ingredients.byId(ingredientId))?.name).toBe("Chicken");
    expect((await repos.ingredients.byId(ingredientId))?.source.kind).toBe(
      "userEntered",
    );
    expect((await repos.ingredients.byId(ingredientId))?.common).toBe(true);
    const restored = await repos.recipeImages.byId(imageId);
    expect(restored?.width).toBe(8);
    expect(restored?.blob.type).toBe("image/png");
    expect(await restored!.blob.arrayBuffer()).toEqual(
      await image.blob.arrayBuffer(),
    );
    expect(await repos.batches.byId(batchId)).toEqual(batch);
  });

  it("accepts a v1-shaped backup payload and normalizes to schema v2", async () => {
    const { db, repos } = await openFresh();
    const v1Payload = {
      formatVersion: 1 as const,
      schemaVersion: 1,
      exportedAt: now(),
      data: {
        ingredients: [
          {
            id: ingredientId,
            name: "Chicken",
            categoryId: null,
            measureKind: "mass",
            nutrition: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
            notes: null,
            archivedAt: null,
          },
        ],
        ingredientCategories: [],
        recipes: [],
        recipeImages: [],
        batches: [],
        pantryStock: [],
        mealSlots: [],
        plannedMeals: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            date: "2026-09-24",
            slotId: SEED_SLOT_IDS.dinner,
            entry: {
              kind: "ingredient",
              ingredientId,
              quantity: { value: 100, unit: "g" },
            },
            position: 0,
            note: null,
          },
        ],
        loggedMeals: [],
        shoppingOverlays: [],
        settings: [
          {
            id: "singleton",
            dailyCalorieTarget: null,
            weekStartsOn: 1,
            themePreference: "system",
            shoppingWindow: null,
          },
        ],
      },
    };

    await importBackup(db, v1Payload);

    const ingredient = await repos.ingredients.byId(ingredientId);
    expect(ingredient?.source.kind).toBe("userEntered");
    expect(ingredient?.common).toBe(true);
    expect(ingredient?.imageId).toBeNull();
    expect(ingredient?.nutrition.kcal).toBe(165);

    const planned = await repos.plannedMeals.byId(
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    );
    expect(planned?.group).toBeNull();
    expect(await db.table("mealTemplates").count()).toBe(0);

    const settings = await repos.settings.get();
    expect(settings.howItWorksDismissed).toBe(false);
    expect(settings.starterPackVersion).toBeNull();
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

    expect((await repos.ingredients.byId(ingredientId))?.name).toBe("Chicken");
    expect(await repos.mealSlots.all()).toHaveLength(4);
  });
});

describe("Dexie schema v2 migration", () => {
  const names: string[] = [];

  afterEach(async () => {
    for (const name of names.splice(0)) {
      await deleteRecipeDb(name);
    }
  });

  it("migrates a v1 database with provenance defaults and complete v2 stores (tests 9, 9a)", async () => {
    const { createSongaraDb } = await import("@songara/pwa-base/preview/dexie");
    const { recipeSchemaV1Stores, recipeSchemaVersions, SEED_CATEGORY_IDS } =
      await import("./index");

    const name = testDbName(`m${Date.now()}${Math.random()}`);
    names.push(name);

    const v1 = createSongaraDb({
      name,
      versions: [{ version: 1, stores: { ...recipeSchemaV1Stores } }],
    });
    await v1.open();
    await v1.table("ingredients").put({
      id: ingredientId,
      name: "Chicken",
      categoryId: null,
      measureKind: "mass",
      nutrition: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      notes: null,
      archivedAt: null,
    });
    await v1.table("ingredientCategories").put({
      id: SEED_CATEGORY_IDS.produce,
      name: "Produce",
      sortOrder: 10,
    });
    await v1.table("plannedMeals").put({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      date: "2026-09-24",
      slotId: SEED_SLOT_IDS.dinner,
      entry: {
        kind: "ingredient",
        ingredientId,
        quantity: { value: 100, unit: "g" },
      },
      position: 0,
      note: null,
    });
    await v1.table("settings").put({
      id: "singleton",
      dailyCalorieTarget: null,
      weekStartsOn: 1,
      themePreference: "system",
      shoppingWindow: null,
    });
    v1.close();

    const v2 = createSongaraDb({
      name,
      versions: recipeSchemaVersions,
    });
    await v2.open();
    expect(v2.verno).toBe(2);

    expect(v2.tables.map((t) => t.name)).toContain("mealTemplates");
    expect(await v2.table("mealTemplates").count()).toBe(0);
    const plannedIndexes = v2
      .table("plannedMeals")
      .schema.indexes.map((idx) => idx.keyPath);
    const loggedIndexes = v2
      .table("loggedMeals")
      .schema.indexes.map((idx) => idx.keyPath);
    expect(plannedIndexes).toContain("group.id");
    expect(loggedIndexes).toContain("group.id");

    const ingredient = await v2.table("ingredients").get(ingredientId);
    expect(ingredient).toMatchObject({
      nutrition: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 },
      source: { kind: "userEntered" },
      common: true,
      imageId: null,
    });

    const category = await v2
      .table("ingredientCategories")
      .get(SEED_CATEGORY_IDS.produce);
    expect(category).toMatchObject({
      icon: "Leaf",
      accent: "--color-success",
    });

    const planned = await v2
      .table("plannedMeals")
      .get("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    expect(planned).toMatchObject({ group: null });

    const settings = await v2.table("settings").get("singleton");
    expect(settings).toMatchObject({
      howItWorksDismissed: false,
      starterPackVersion: null,
    });

    v2.close();
  });
});

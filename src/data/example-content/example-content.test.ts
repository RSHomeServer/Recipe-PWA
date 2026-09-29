import { describe, expect, it } from "vitest";
import flavourPackJson from "../../../public/starter-pack/flavour-pack.json";
import starterPackJson from "../../../public/starter-pack/pack.json";
import {
  deleteRecipeDb,
  openRecipeDb,
  type FlavourPackFile,
  type StarterPackFile,
} from "@/data";
import {
  MealTemplateSchema,
  RecipeSchema,
  type Ingredient,
  type MealTemplate,
  type Recipe,
} from "@/domain";
import {
  EXAMPLE_MIXES,
  EXAMPLE_SNACKS,
  allExamplePackRefs,
  installExampleContent,
} from "./index";

const starterPack = starterPackJson as StarterPackFile;
const flavourPack = flavourPackJson as FlavourPackFile;

function packKey(ingredient: {
  source: { datasetId: string | null; entryCode: string | null };
}): string | null {
  const { datasetId, entryCode } = ingredient.source;
  if (!datasetId || !entryCode) return null;
  return `${datasetId}::${entryCode}`;
}

describe("example content catalogue (R6.3)", () => {
  it("defines roughly 6 mixes and 4 snacks", () => {
    expect(EXAMPLE_MIXES).toHaveLength(6);
    expect(EXAMPLE_SNACKS).toHaveLength(4);
  });

  it("composes every line and snack base from seeded pack ingredients only", () => {
    const known = new Set<string>();
    for (const row of starterPack.ingredients) {
      const key = packKey(row);
      if (key) known.add(key);
    }
    for (const row of flavourPack.ingredients) {
      const key = packKey(row);
      if (key) known.add(key);
    }

    for (const ref of allExamplePackRefs()) {
      expect(known.has(ref), `unknown pack ref ${ref}`).toBe(true);
    }

    for (const snack of EXAMPLE_SNACKS) {
      expect(
        EXAMPLE_MIXES.some((m) => m.id === snack.mixId),
        `snack ${snack.name} references unknown mix`,
      ).toBe(true);
    }
  });

  it("uses stable unique ids across mixes, snacks, lines, and components", () => {
    const ids = new Set<string>();
    const take = (id: string, label: string) => {
      expect(ids.has(id), `duplicate id ${id} (${label})`).toBe(false);
      ids.add(id);
    };
    for (const mix of EXAMPLE_MIXES) {
      take(mix.id, mix.name);
      for (const line of mix.lines) take(line.id, `${mix.name} line`);
    }
    for (const snack of EXAMPLE_SNACKS) {
      take(snack.id, snack.name);
      take(snack.baseComponentId, `${snack.name} base`);
      take(snack.mixComponentId, `${snack.name} mix`);
    }
  });
});

describe("installExampleContent (R6.1, R6.4)", () => {
  it("is not seeded on first-run open (R6.1)", async () => {
    const name = `example-content-noseed-${crypto.randomUUID()}`;
    const db = await openRecipeDb({ name, ephemeral: true });
    expect(await db.table("recipes").count()).toBe(0);
    expect(await db.table("mealTemplates").count()).toBe(0);
    await db.close();
    await deleteRecipeDb(name);
  });

  it("adds mixes and snacks once, and a second run adds nothing", async () => {
    const name = `example-content-${crypto.randomUUID()}`;
    const db = await openRecipeDb({ name, ephemeral: true });

    const first = await installExampleContent(db);
    expect(first.missingIngredientRefs).toEqual([]);
    expect(first.mixesAdded).toBe(6);
    expect(first.snacksAdded).toBe(4);
    expect(first.mixesSkippedExisting).toBe(0);
    expect(first.snacksSkippedExisting).toBe(0);

    const recipes = (await db.table("recipes").toArray()) as Recipe[];
    const templates = (await db
      .table("mealTemplates")
      .toArray()) as MealTemplate[];
    const mixes = recipes.filter((r) => r.kind === "mix");
    expect(mixes).toHaveLength(6);
    expect(templates).toHaveLength(4);

    for (const mix of mixes) {
      expect(RecipeSchema.parse(mix).kind).toBe("mix");
    }
    for (const template of templates) {
      MealTemplateSchema.parse(template);
    }

    const second = await installExampleContent(db);
    expect(second.mixesAdded).toBe(0);
    expect(second.snacksAdded).toBe(0);
    expect(second.mixesSkippedExisting).toBe(6);
    expect(second.snacksSkippedExisting).toBe(4);
    expect(await db.table("recipes").count()).toBe(6);
    expect(await db.table("mealTemplates").count()).toBe(4);

    await db.close();
    await deleteRecipeDb(name);
  });

  it("never overwrites a user edit to an example mix or snack", async () => {
    const name = `example-content-edit-${crypto.randomUUID()}`;
    const db = await openRecipeDb({ name, ephemeral: true });

    await installExampleContent(db);
    const mixId = EXAMPLE_MIXES[0]!.id;
    const snackId = EXAMPLE_SNACKS[0]!.id;

    const mix = (await db.table("recipes").get(mixId)) as Recipe;
    const editedMix: Recipe = {
      ...mix,
      name: "My renamed vinegar",
      servings: 5,
      notes: "user edit",
      updatedAt: "2026-09-29T12:00:00.000Z",
    };
    await db.table("recipes").put(editedMix);

    const snack = (await db.table("mealTemplates").get(snackId)) as MealTemplate;
    const editedSnack: MealTemplate = {
      ...snack,
      name: "My cucumber snack",
      updatedAt: "2026-09-29T12:00:00.000Z",
    };
    await db.table("mealTemplates").put(editedSnack);

    const report = await installExampleContent(db);
    expect(report.mixesAdded).toBe(0);
    expect(report.snacksAdded).toBe(0);
    expect(report.mixesSkippedExisting).toBe(6);
    expect(report.snacksSkippedExisting).toBe(4);

    const mixAfter = (await db.table("recipes").get(mixId)) as Recipe;
    expect(mixAfter.name).toBe("My renamed vinegar");
    expect(mixAfter.servings).toBe(5);
    expect(mixAfter.notes).toBe("user edit");
    expect(mixAfter.updatedAt).toBe("2026-09-29T12:00:00.000Z");

    const snackAfter = (await db
      .table("mealTemplates")
      .get(snackId)) as MealTemplate;
    expect(snackAfter.name).toBe("My cucumber snack");
    expect(snackAfter.updatedAt).toBe("2026-09-29T12:00:00.000Z");

    await db.close();
    await deleteRecipeDb(name);
  });

  it("re-adds a deleted example without touching remaining ones", async () => {
    const name = `example-content-readd-${crypto.randomUUID()}`;
    const db = await openRecipeDb({ name, ephemeral: true });

    await installExampleContent(db);
    const removed = EXAMPLE_MIXES[1]!;
    await db.table("recipes").delete(removed.id);
    expect(await db.table("recipes").count()).toBe(5);

    const kept = (await db
      .table("recipes")
      .get(EXAMPLE_MIXES[0]!.id)) as Recipe;
    const renamed: Recipe = { ...kept, name: "Keep my edit" };
    await db.table("recipes").put(renamed);

    const report = await installExampleContent(db);
    expect(report.mixesAdded).toBe(1);
    expect(report.mixesSkippedExisting).toBe(5);
    expect(report.snacksAdded).toBe(0);

    const restored = (await db.table("recipes").get(removed.id)) as Recipe;
    expect(restored.name).toBe(removed.name);
    expect(restored.kind).toBe("mix");

    const stillEdited = (await db
      .table("recipes")
      .get(EXAMPLE_MIXES[0]!.id)) as Recipe;
    expect(stillEdited.name).toBe("Keep my edit");

    await db.close();
    await deleteRecipeDb(name);
  });

  it("resolves mix lines to live pack ingredient ids", async () => {
    const name = `example-content-resolve-${crypto.randomUUID()}`;
    const db = await openRecipeDb({ name, ephemeral: true });

    await installExampleContent(db);
    const vinegar = (await db
      .table("recipes")
      .get(EXAMPLE_MIXES[0]!.id)) as Recipe;
    const ingredients = (await db.table("ingredients").toArray()) as Ingredient[];
    const byId = new Map(ingredients.map((i) => [i.id, i]));

    for (const line of vinegar.lines) {
      const ingredient = byId.get(line.ingredientId);
      expect(ingredient, `missing ingredient for line ${line.id}`).toBeTruthy();
      const key = packKey(ingredient!);
      expect(key).toBeTruthy();
      expect(allExamplePackRefs()).toContain(key);
    }

    await db.close();
    await deleteRecipeDb(name);
  });
});

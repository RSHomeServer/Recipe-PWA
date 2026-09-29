import type Dexie from "dexie";
import {
  MealTemplateSchema,
  RecipeSchema,
  type Ingredient,
  type MealTemplate,
  type Recipe,
} from "@/domain";
import { SEED_SLOT_IDS } from "../seeds";
import { seedBothPacks, type DualPackSeedReport } from "../starter-pack";
import {
  EXAMPLE_MIXES,
  EXAMPLE_SNACKS,
  type ExampleMixDef,
  type ExampleSnackDef,
  type PackIngredientRef,
} from "./catalogue";

export type ExampleContentInstallReport = {
  mixesAdded: number;
  mixesSkippedExisting: number;
  snacksAdded: number;
  snacksSkippedExisting: number;
  missingIngredientRefs: PackIngredientRef[];
  packs: DualPackSeedReport;
};

function entryCodeKey(ingredient: Ingredient): string | null {
  const code = ingredient.source.entryCode;
  const datasetId = ingredient.source.datasetId;
  if (!code || !datasetId) return null;
  return `${datasetId}::${code}`;
}

function indexIngredientsByPackKey(
  rows: Ingredient[],
): Map<string, Ingredient> {
  const byKey = new Map<string, Ingredient>();
  for (const row of rows) {
    const key = entryCodeKey(row);
    if (key) byKey.set(key, row);
  }
  return byKey;
}

function buildMix(
  def: ExampleMixDef,
  byKey: Map<string, Ingredient>,
  now: string,
): { recipe: Recipe } | { missing: PackIngredientRef[] } {
  const missing: PackIngredientRef[] = [];
  const lines = [];
  for (const line of def.lines) {
    const ingredient = byKey.get(line.ref);
    if (!ingredient) {
      missing.push(line.ref);
      continue;
    }
    lines.push({
      id: line.id,
      ingredientId: ingredient.id,
      quantity: line.quantity,
      displayUnit: line.displayUnit,
      optional: false,
      note: null,
      entryHint: line.entryHint,
    });
  }
  if (missing.length > 0) return { missing };

  const recipe = RecipeSchema.parse({
    id: def.id,
    name: def.name,
    servings: def.servings,
    kind: "mix",
    lines,
    steps: [],
    tags: [],
    imageId: null,
    notes: def.notes,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
  return { recipe };
}

function buildSnack(
  def: ExampleSnackDef,
  byKey: Map<string, Ingredient>,
  now: string,
): { template: MealTemplate } | { missing: PackIngredientRef[] } {
  const base = byKey.get(def.base.ref);
  if (!base) return { missing: [def.base.ref] };

  const template = MealTemplateSchema.parse({
    id: def.id,
    name: def.name,
    components: [
      {
        id: def.baseComponentId,
        entry: {
          kind: "ingredient",
          ingredientId: base.id,
          quantity: def.base.quantity,
        },
        note: null,
      },
      {
        id: def.mixComponentId,
        entry: {
          kind: "recipeServings",
          recipeId: def.mixId,
          servings: def.mixServings,
        },
        note: null,
      },
    ],
    defaultSlotId: SEED_SLOT_IDS.snack,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
  return { template };
}

/**
 * Opt-in install of example mixes and snacks (R6.1–R6.4).
 *
 * - Tops up CoFID + flavour packs first (additive; never overwrites edits).
 * - Inserts ordinary Recipe (kind: mix) and MealTemplate rows.
 * - Idempotent by stable id: existing rows are skipped, never overwritten.
 */
export async function installExampleContent(
  db: Dexie,
): Promise<ExampleContentInstallReport> {
  const packs = await seedBothPacks(db);
  const ingredients = (await db.table("ingredients").toArray()) as Ingredient[];
  const byKey = indexIngredientsByPackKey(ingredients);

  const existingRecipeIds = new Set(
    ((await db.table("recipes").toArray()) as Recipe[]).map((r) => r.id),
  );
  const existingTemplateIds = new Set(
    ((await db.table("mealTemplates").toArray()) as MealTemplate[]).map(
      (t) => t.id,
    ),
  );

  const report: ExampleContentInstallReport = {
    mixesAdded: 0,
    mixesSkippedExisting: 0,
    snacksAdded: 0,
    snacksSkippedExisting: 0,
    missingIngredientRefs: [],
    packs,
  };

  const missing = new Set<PackIngredientRef>();
  const now = new Date().toISOString();
  const mixesToAdd: Recipe[] = [];
  const snacksToAdd: MealTemplate[] = [];

  for (const def of EXAMPLE_MIXES) {
    if (existingRecipeIds.has(def.id)) {
      report.mixesSkippedExisting += 1;
      continue;
    }
    const built = buildMix(def, byKey, now);
    if ("missing" in built) {
      for (const ref of built.missing) missing.add(ref);
      continue;
    }
    mixesToAdd.push(built.recipe);
  }

  for (const def of EXAMPLE_SNACKS) {
    if (existingTemplateIds.has(def.id)) {
      report.snacksSkippedExisting += 1;
      continue;
    }
    // Snack needs its mix present (just added or already in DB).
    const mixPresent =
      existingRecipeIds.has(def.mixId) ||
      mixesToAdd.some((m) => m.id === def.mixId);
    if (!mixPresent) {
      // Mix failed to resolve ingredients — snack cannot be built.
      const mixDef = EXAMPLE_MIXES.find((m) => m.id === def.mixId);
      if (mixDef) {
        for (const line of mixDef.lines) {
          if (!byKey.has(line.ref)) missing.add(line.ref);
        }
      }
      continue;
    }
    const built = buildSnack(def, byKey, now);
    if ("missing" in built) {
      for (const ref of built.missing) missing.add(ref);
      continue;
    }
    snacksToAdd.push(built.template);
  }

  report.missingIngredientRefs = [...missing].sort();

  await db.transaction(
    "rw",
    [db.table("recipes"), db.table("mealTemplates")],
    async () => {
      if (mixesToAdd.length > 0) {
        await db.table("recipes").bulkPut(mixesToAdd);
      }
      if (snacksToAdd.length > 0) {
        await db.table("mealTemplates").bulkPut(snacksToAdd);
      }
    },
  );

  report.mixesAdded = mixesToAdd.length;
  report.snacksAdded = snacksToAdd.length;
  return report;
}

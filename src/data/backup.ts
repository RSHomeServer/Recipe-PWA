import { z } from "zod";
import type Dexie from "dexie";
import {
  BatchSchema,
  IngredientCategorySchema,
  IngredientSchema,
  LoggedMealSchema,
  MealSlotSchema,
  MealTemplateSchema,
  PantryStockSchema,
  PlannedMealSchema,
  RecipeImageExportSchema,
  RecipeImageSchema,
  RecipeSchema,
  SettingsSchema,
  ShoppingOverlaySchema,
  normalizeCategoryRow,
  normalizeIngredientRow,
  normalizePlanGroupField,
  normalizeSettingsRow,
  type RecipeImage,
  type RecipeImageExport,
} from "@/domain";
import { RECIPE_SCHEMA_VERSION, RECIPE_TABLE_NAMES } from "./schema";

export const BackupV1Schema = z.object({
  formatVersion: z.literal(1),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string().min(1),
  data: z.object({
    ingredients: z.array(z.unknown()),
    ingredientCategories: z.array(z.unknown()),
    recipes: z.array(z.unknown()),
    recipeImages: z.array(z.unknown()),
    batches: z.array(z.unknown()),
    pantryStock: z.array(z.unknown()),
    mealSlots: z.array(z.unknown()),
    /** Present from schema v2; absent on v1 exports → treat as empty. */
    mealTemplates: z.array(z.unknown()).optional().default([]),
    plannedMeals: z.array(z.unknown()),
    loggedMeals: z.array(z.unknown()),
    shoppingOverlays: z.array(z.unknown()),
    settings: z.array(z.unknown()),
  }),
});
export type BackupV1 = z.infer<typeof BackupV1Schema>;

export class BackupSchemaTooNewError extends Error {
  constructor(backupVersion: number, appVersion: number) {
    super(
      `Backup schemaVersion ${backupVersion} is newer than this app (${appVersion}); refuse import`,
    );
    this.name = "BackupSchemaTooNewError";
  }
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

async function blobToBase64(blob: Blob): Promise<{
  blobBase64: string;
  mimeType: string;
}> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return {
    blobBase64: btoa(binary),
    mimeType: blob.type || "application/octet-stream",
  };
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function recipeImageToExport(
  image: RecipeImage,
): Promise<RecipeImageExport> {
  const { blobBase64, mimeType } = await blobToBase64(image.blob);
  return RecipeImageExportSchema.parse({
    id: image.id,
    blobBase64,
    mimeType,
    width: image.width,
    height: image.height,
  });
}

export function recipeImageFromExport(row: RecipeImageExport): RecipeImage {
  return RecipeImageSchema.parse({
    id: row.id,
    blob: base64ToBlob(row.blobBase64, row.mimeType),
    width: row.width,
    height: row.height,
  });
}

type ParsedBackupData = {
  ingredients: ReturnType<typeof IngredientSchema.parse>[];
  ingredientCategories: ReturnType<typeof IngredientCategorySchema.parse>[];
  recipes: ReturnType<typeof RecipeSchema.parse>[];
  recipeImages: RecipeImage[];
  batches: ReturnType<typeof BatchSchema.parse>[];
  pantryStock: ReturnType<typeof PantryStockSchema.parse>[];
  mealSlots: ReturnType<typeof MealSlotSchema.parse>[];
  mealTemplates: ReturnType<typeof MealTemplateSchema.parse>[];
  plannedMeals: ReturnType<typeof PlannedMealSchema.parse>[];
  loggedMeals: ReturnType<typeof LoggedMealSchema.parse>[];
  shoppingOverlays: ReturnType<typeof ShoppingOverlaySchema.parse>[];
  settings: ReturnType<typeof SettingsSchema.parse>[];
};

function parseAllTables(data: BackupV1["data"]): ParsedBackupData {
  const parseArray = <T>(
    table: string,
    schema: z.ZodType<T>,
    rows: unknown[],
    normalize?: (row: unknown) => unknown,
  ): T[] => {
    return rows.map((row, i) => {
      const candidate = normalize ? normalize(row) : row;
      const result = schema.safeParse(candidate);
      if (!result.success) {
        throw new BackupValidationError(
          `${table}[${i}]: ${result.error.issues.map((x) => x.message).join("; ")}`,
        );
      }
      return result.data;
    });
  };

  const recipeImages = data.recipeImages.map((row, i) => {
    const exported = RecipeImageExportSchema.safeParse(row);
    if (!exported.success) {
      throw new BackupValidationError(
        `recipeImages[${i}]: ${exported.error.issues.map((x) => x.message).join("; ")}`,
      );
    }
    return recipeImageFromExport(exported.data);
  });

  return {
    ingredients: parseArray(
      "ingredients",
      IngredientSchema,
      data.ingredients,
      normalizeIngredientRow,
    ),
    ingredientCategories: parseArray(
      "ingredientCategories",
      IngredientCategorySchema,
      data.ingredientCategories,
      normalizeCategoryRow,
    ),
    recipes: parseArray("recipes", RecipeSchema, data.recipes),
    recipeImages,
    batches: parseArray("batches", BatchSchema, data.batches),
    pantryStock: parseArray("pantryStock", PantryStockSchema, data.pantryStock),
    mealSlots: parseArray("mealSlots", MealSlotSchema, data.mealSlots),
    mealTemplates: parseArray(
      "mealTemplates",
      MealTemplateSchema,
      data.mealTemplates ?? [],
    ),
    plannedMeals: parseArray(
      "plannedMeals",
      PlannedMealSchema,
      data.plannedMeals,
      normalizePlanGroupField,
    ),
    loggedMeals: parseArray(
      "loggedMeals",
      LoggedMealSchema,
      data.loggedMeals,
      normalizePlanGroupField,
    ),
    shoppingOverlays: parseArray(
      "shoppingOverlays",
      ShoppingOverlaySchema,
      data.shoppingOverlays,
    ),
    settings: parseArray(
      "settings",
      SettingsSchema,
      data.settings,
      normalizeSettingsRow,
    ),
  };
}

export async function exportBackup(db: Dexie): Promise<BackupV1> {
  const byTable = Object.fromEntries(
    await Promise.all(
      RECIPE_TABLE_NAMES.map(async (name) => [
        name,
        await db.table(name).toArray(),
      ]),
    ),
  ) as Record<(typeof RECIPE_TABLE_NAMES)[number], unknown[]>;

  const recipeImages = await Promise.all(
    (byTable.recipeImages as RecipeImage[]).map(async (row) => {
      const parsed = RecipeImageSchema.parse(row);
      return recipeImageToExport(parsed);
    }),
  );

  return BackupV1Schema.parse({
    formatVersion: 1,
    schemaVersion: RECIPE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      ingredients: byTable.ingredients,
      ingredientCategories: byTable.ingredientCategories,
      recipes: byTable.recipes,
      recipeImages,
      batches: byTable.batches,
      pantryStock: byTable.pantryStock,
      mealSlots: byTable.mealSlots,
      mealTemplates: byTable.mealTemplates,
      plannedMeals: byTable.plannedMeals,
      loggedMeals: byTable.loggedMeals,
      shoppingOverlays: byTable.shoppingOverlays,
      settings: byTable.settings,
    },
  });
}

/**
 * Validate the entire payload, then replace all tables in one transaction.
 * Refuses backups with schemaVersion newer than the running app.
 * Accepts v1 payloads (normalizes missing V2 fields). Never merges.
 */
export async function importBackup(
  db: Dexie,
  payload: unknown,
): Promise<void> {
  const envelope = BackupV1Schema.safeParse(payload);
  if (!envelope.success) {
    throw new BackupValidationError(
      envelope.error.issues.map((i) => i.message).join("; "),
    );
  }

  if (envelope.data.schemaVersion > RECIPE_SCHEMA_VERSION) {
    throw new BackupSchemaTooNewError(
      envelope.data.schemaVersion,
      RECIPE_SCHEMA_VERSION,
    );
  }

  const parsed = parseAllTables(envelope.data.data);

  await db.transaction("rw", RECIPE_TABLE_NAMES, async () => {
    for (const name of RECIPE_TABLE_NAMES) {
      await db.table(name).clear();
    }

    await db.table("ingredients").bulkPut(parsed.ingredients);
    await db
      .table("ingredientCategories")
      .bulkPut(parsed.ingredientCategories);
    await db.table("recipes").bulkPut(parsed.recipes);
    await db.table("recipeImages").bulkPut(parsed.recipeImages);
    await db.table("batches").bulkPut(parsed.batches);
    await db.table("pantryStock").bulkPut(parsed.pantryStock);
    await db.table("mealSlots").bulkPut(parsed.mealSlots);
    await db.table("mealTemplates").bulkPut(parsed.mealTemplates);
    await db.table("plannedMeals").bulkPut(parsed.plannedMeals);
    await db.table("loggedMeals").bulkPut(parsed.loggedMeals);
    await db.table("shoppingOverlays").bulkPut(parsed.shoppingOverlays);
    await db.table("settings").bulkPut(parsed.settings);
  });
}

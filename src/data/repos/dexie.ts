import type Dexie from "dexie";
import {
  BatchSchema,
  IngredientCategorySchema,
  IngredientSchema,
  LoggedMealSchema,
  MealSlotSchema,
  PantryStockSchema,
  PlannedMealSchema,
  RecipeImageSchema,
  RecipeSchema,
  SettingsSchema,
  ShoppingOverlaySchema,
  normalizeSettingsRow,
  type BatchUpdate,
} from "@/domain";
import { DEFAULT_SETTINGS } from "@/domain";
import { parseRow, parseRows } from "../parse";
import { assertSnapshotUnchanged } from "./snapshot-guard";
import type {
  BatchRepo,
  IngredientCategoryRepo,
  IngredientRepo,
  LoggedMealRepo,
  MealSlotRepo,
  PantryStockRepo,
  PlannedMealRepo,
  RecipeImageRepo,
  RecipeRepo,
  RecipeRepositories,
  SettingsRepo,
  ShoppingOverlayRepo,
} from "./types";

export function createDexieRepositories(db: Dexie): RecipeRepositories {
  const ingredients: IngredientRepo = {
    async all() {
      const rows = await db.table("ingredients").toArray();
      return parseRows(IngredientSchema, "ingredients", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async byId(id) {
      const row = await db.table("ingredients").get(id);
      return row
        ? parseRow(IngredientSchema, "ingredients", row, id)
        : undefined;
    },
    async put(row) {
      await db.table("ingredients").put(IngredientSchema.parse(row));
    },
    async archive(id, archivedAt) {
      const existing = await this.byId(id);
      if (!existing) throw new Error(`Ingredient ${id} not found`);
      await db.table("ingredients").put({ ...existing, archivedAt });
    },
  };

  const ingredientCategories: IngredientCategoryRepo = {
    async all() {
      const rows = await db.table("ingredientCategories").toArray();
      return parseRows(
        IngredientCategorySchema,
        "ingredientCategories",
        rows,
        (r) => (r as { id: string }).id,
      );
    },
    async byId(id) {
      const row = await db.table("ingredientCategories").get(id);
      return row
        ? parseRow(
            IngredientCategorySchema,
            "ingredientCategories",
            row,
            id,
          )
        : undefined;
    },
    async put(row) {
      await db
        .table("ingredientCategories")
        .put(IngredientCategorySchema.parse(row));
    },
    async delete(id) {
      await db.table("ingredientCategories").delete(id);
    },
  };

  const recipes: RecipeRepo = {
    async all() {
      const rows = await db.table("recipes").toArray();
      return parseRows(RecipeSchema, "recipes", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async byId(id) {
      const row = await db.table("recipes").get(id);
      return row ? parseRow(RecipeSchema, "recipes", row, id) : undefined;
    },
    async put(row) {
      await db.table("recipes").put(RecipeSchema.parse(row));
    },
    async archive(id, archivedAt) {
      const existing = await this.byId(id);
      if (!existing) throw new Error(`Recipe ${id} not found`);
      await db.table("recipes").put({ ...existing, archivedAt });
    },
  };

  const recipeImages: RecipeImageRepo = {
    async byId(id) {
      const row = await db.table("recipeImages").get(id);
      return row
        ? parseRow(RecipeImageSchema, "recipeImages", row, id)
        : undefined;
    },
    async put(row) {
      await db.table("recipeImages").put(RecipeImageSchema.parse(row));
    },
    async delete(id) {
      await db.table("recipeImages").delete(id);
    },
  };

  const batches: BatchRepo = {
    async all() {
      const rows = await db.table("batches").toArray();
      return parseRows(BatchSchema, "batches", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async byId(id) {
      const row = await db.table("batches").get(id);
      return row ? parseRow(BatchSchema, "batches", row, id) : undefined;
    },
    async byRecipeId(recipeId) {
      const rows = await db.table("batches").where("recipeId").equals(recipeId).toArray();
      return parseRows(BatchSchema, "batches", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async create(row) {
      const parsed = BatchSchema.parse(row);
      const existing = await db.table("batches").get(parsed.id);
      if (existing) throw new Error(`Batch ${parsed.id} already exists`);
      await db.table("batches").add(parsed);
    },
    async update(id, patch: BatchUpdate) {
      if (
        patch !== null &&
        typeof patch === "object" &&
        Object.prototype.hasOwnProperty.call(patch, "snapshot")
      ) {
        throw new Error(`Batch.snapshot cannot be updated (batch ${id})`);
      }
      const existing = await this.byId(id);
      if (!existing) throw new Error(`Batch ${id} not found`);
      const next = BatchSchema.parse({ ...existing, ...patch, id });
      assertSnapshotUnchanged(existing, next.snapshot);
      await db.table("batches").put(next);
    },
    async put(row) {
      const parsed = BatchSchema.parse(row);
      const existing = await this.byId(parsed.id);
      if (existing) {
        assertSnapshotUnchanged(existing, parsed.snapshot);
      }
      await db.table("batches").put(parsed);
    },
  };

  const pantryStock: PantryStockRepo = {
    async all() {
      const rows = await db.table("pantryStock").toArray();
      return parseRows(PantryStockSchema, "pantryStock", rows, (r) =>
        (r as { ingredientId: string }).ingredientId,
      );
    },
    async byIngredientId(ingredientId) {
      const row = await db.table("pantryStock").get(ingredientId);
      return row
        ? parseRow(PantryStockSchema, "pantryStock", row, ingredientId)
        : undefined;
    },
    async put(row) {
      await db.table("pantryStock").put(PantryStockSchema.parse(row));
    },
    async delete(ingredientId) {
      await db.table("pantryStock").delete(ingredientId);
    },
  };

  const mealSlots: MealSlotRepo = {
    async all() {
      const rows = await db.table("mealSlots").toArray();
      return parseRows(MealSlotSchema, "mealSlots", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async byId(id) {
      const row = await db.table("mealSlots").get(id);
      return row ? parseRow(MealSlotSchema, "mealSlots", row, id) : undefined;
    },
    async put(row) {
      await db.table("mealSlots").put(MealSlotSchema.parse(row));
    },
    async delete(id) {
      await db.table("mealSlots").delete(id);
    },
  };

  const plannedMeals: PlannedMealRepo = {
    async all() {
      const rows = await db.table("plannedMeals").toArray();
      return parseRows(PlannedMealSchema, "plannedMeals", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async byId(id) {
      const row = await db.table("plannedMeals").get(id);
      return row
        ? parseRow(PlannedMealSchema, "plannedMeals", row, id)
        : undefined;
    },
    async byDate(date) {
      const rows = await db.table("plannedMeals").where("date").equals(date).toArray();
      return parseRows(PlannedMealSchema, "plannedMeals", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async put(row) {
      await db.table("plannedMeals").put(PlannedMealSchema.parse(row));
    },
    async delete(id) {
      await db.table("plannedMeals").delete(id);
    },
  };

  const loggedMeals: LoggedMealRepo = {
    async all() {
      const rows = await db.table("loggedMeals").toArray();
      return parseRows(LoggedMealSchema, "loggedMeals", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async byId(id) {
      const row = await db.table("loggedMeals").get(id);
      return row
        ? parseRow(LoggedMealSchema, "loggedMeals", row, id)
        : undefined;
    },
    async byDate(date) {
      const rows = await db.table("loggedMeals").where("date").equals(date).toArray();
      return parseRows(LoggedMealSchema, "loggedMeals", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async put(row) {
      await db.table("loggedMeals").put(LoggedMealSchema.parse(row));
    },
    async delete(id) {
      await db.table("loggedMeals").delete(id);
    },
  };

  const shoppingOverlays: ShoppingOverlayRepo = {
    async all() {
      const rows = await db.table("shoppingOverlays").toArray();
      return parseRows(ShoppingOverlaySchema, "shoppingOverlays", rows, (r) =>
        (r as { id: string }).id,
      );
    },
    async byId(id) {
      const row = await db.table("shoppingOverlays").get(id);
      return row
        ? parseRow(ShoppingOverlaySchema, "shoppingOverlays", row, id)
        : undefined;
    },
    async byWindowKey(windowKey) {
      const row = await db
        .table("shoppingOverlays")
        .where("windowKey")
        .equals(windowKey)
        .first();
      return row
        ? parseRow(
            ShoppingOverlaySchema,
            "shoppingOverlays",
            row,
            (row as { id: string }).id,
          )
        : undefined;
    },
    async put(row) {
      await db
        .table("shoppingOverlays")
        .put(ShoppingOverlaySchema.parse(row));
    },
    async delete(id) {
      await db.table("shoppingOverlays").delete(id);
    },
  };

  const settings: SettingsRepo = {
    async get() {
      const row = await db.table("settings").get("singleton");
      if (!row) {
        const fallback = SettingsSchema.parse(DEFAULT_SETTINGS);
        await db.table("settings").put(fallback);
        return fallback;
      }
      return parseRow(
        SettingsSchema,
        "settings",
        normalizeSettingsRow(row),
        "singleton",
      );
    },
    async put(row) {
      await db.table("settings").put(SettingsSchema.parse(row));
    },
  };

  return {
    ingredients,
    ingredientCategories,
    recipes,
    recipeImages,
    batches,
    pantryStock,
    mealSlots,
    plannedMeals,
    loggedMeals,
    shoppingOverlays,
    settings,
  };
}

import { z } from "zod";
import { NutritionSchema } from "../nutrition/schemas";
import { QuantitySchema } from "../units/schemas";
import { IdSchema } from "./primitives";

export const CustomFoodSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().finite().positive(),
  nutrition: NutritionSchema,
});
export type CustomFood = z.infer<typeof CustomFoodSchema>;

const RecipeServingsEntrySchema = z.object({
  kind: z.literal("recipeServings"),
  recipeId: IdSchema,
  servings: z.number().finite().positive(),
});

const BatchPortionsEntrySchema = z.object({
  kind: z.literal("batchPortions"),
  batchId: IdSchema,
  portions: z.number().finite().positive(),
});

const IngredientEntrySchema = z.object({
  kind: z.literal("ingredient"),
  ingredientId: IdSchema,
  quantity: QuantitySchema,
});

const CustomFoodEntrySchema = z.object({
  kind: z.literal("customFood"),
  food: CustomFoodSchema,
});

/** Shared by plan and log — customFood allowed only on logs. */
export const MealEntrySchema = z.discriminatedUnion("kind", [
  RecipeServingsEntrySchema,
  BatchPortionsEntrySchema,
  IngredientEntrySchema,
  CustomFoodEntrySchema,
]);
export type MealEntry = z.infer<typeof MealEntrySchema>;

/** Planned meals reject customFood (DOMAIN_MODEL). */
export const PlanMealEntrySchema = z.discriminatedUnion("kind", [
  RecipeServingsEntrySchema,
  BatchPortionsEntrySchema,
  IngredientEntrySchema,
]);
export type PlanMealEntry = z.infer<typeof PlanMealEntrySchema>;

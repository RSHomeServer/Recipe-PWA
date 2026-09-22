import { z } from "zod";
import {
  CanonicalQuantitySchema,
  MeasureKindSchema,
  UnitSchema,
} from "../units/schemas";

export const NutritionSchema = z.object({
  kcal: z.number().finite().nonnegative(),
  proteinG: z.number().finite().nonnegative(),
  carbsG: z.number().finite().nonnegative(),
  fatG: z.number().finite().nonnegative(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

/** Minimal ingredient shape for nutritionOf / recipe helpers. */
export const NutritionIngredientSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  measureKind: MeasureKindSchema,
  nutrition: NutritionSchema,
});
export type NutritionIngredient = z.infer<typeof NutritionIngredientSchema>;

export const RecipeLineInputSchema = z.object({
  id: z.string().min(1),
  ingredientId: z.string().min(1),
  quantity: CanonicalQuantitySchema,
  displayUnit: UnitSchema,
  optional: z.boolean(),
  note: z.string().nullable().optional(),
});
export type RecipeLineInput = z.infer<typeof RecipeLineInputSchema>;

export const RecipeInputSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  servings: z.number().finite().positive(),
  lines: z.array(RecipeLineInputSchema),
});
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

export const BatchSnapshotLineSchema = z.object({
  ingredientId: z.string().min(1),
  ingredientName: z.string(),
  quantity: CanonicalQuantitySchema,
  nutrition: NutritionSchema,
});
export type BatchSnapshotLine = z.infer<typeof BatchSnapshotLineSchema>;

export const BatchSnapshotSchema = z.object({
  recipeName: z.string(),
  lines: z.array(BatchSnapshotLineSchema),
  total: NutritionSchema,
});
export type BatchSnapshot = z.infer<typeof BatchSnapshotSchema>;

/** Minimal batch shape for portion helpers. */
export const BatchNutritionInputSchema = z.object({
  portionsNominal: z.number().finite().positive(),
  snapshot: BatchSnapshotSchema,
});
export type BatchNutritionInput = z.infer<typeof BatchNutritionInputSchema>;

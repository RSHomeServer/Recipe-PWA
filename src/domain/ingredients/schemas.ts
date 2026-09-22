import { z } from "zod";
import { NutritionSchema } from "../nutrition/schemas";
import { MeasureKindSchema } from "../units/schemas";
import { IdSchema, IsoDateTimeSchema } from "../shared/primitives";

export const IngredientSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  categoryId: IdSchema.nullable(),
  measureKind: MeasureKindSchema,
  nutrition: NutritionSchema,
  notes: z.string().nullable(),
  archivedAt: IsoDateTimeSchema.nullable(),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

export const IngredientCategorySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  sortOrder: z.number().finite().int(),
});
export type IngredientCategory = z.infer<typeof IngredientCategorySchema>;

import { z } from "zod";
import { QuantitySchema } from "../units/schemas";
import {
  IdSchema,
  IsoDateTimeSchema,
} from "../shared/primitives";

/**
 * Meal templates (ADR-004). Declared in Dexie v2 by ticket 4; behaviour arrives
 * in ticket 7. Schema must validate backup rows even while the table is empty.
 */

const RecipeServingsComponentEntrySchema = z.object({
  kind: z.literal("recipeServings"),
  recipeId: IdSchema,
  servings: z.number().finite().positive(),
});

const IngredientComponentEntrySchema = z.object({
  kind: z.literal("ingredient"),
  ingredientId: IdSchema,
  quantity: QuantitySchema,
});

/** Templates reject batchPortions and customFood (ADR-004 §1). */
export const MealTemplateEntrySchema = z.discriminatedUnion("kind", [
  RecipeServingsComponentEntrySchema,
  IngredientComponentEntrySchema,
]);
export type MealTemplateEntry = z.infer<typeof MealTemplateEntrySchema>;

export const MealTemplateComponentSchema = z.object({
  id: IdSchema,
  entry: MealTemplateEntrySchema,
  note: z.string().nullable(),
});
export type MealTemplateComponent = z.infer<typeof MealTemplateComponentSchema>;

export const MealTemplateSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  components: z.array(MealTemplateComponentSchema),
  defaultSlotId: IdSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  archivedAt: IsoDateTimeSchema.nullable(),
});
export type MealTemplate = z.infer<typeof MealTemplateSchema>;

/** Display-only correlation tag on planned/logged meals (ADR-004 §2). */
export const PlanGroupSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  templateId: IdSchema.nullable(),
});
export type PlanGroup = z.infer<typeof PlanGroupSchema>;

export function normalizePlanGroupField(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  if ("group" in record) return row;
  return { ...record, group: null };
}

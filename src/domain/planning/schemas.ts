import { z } from "zod";
import { PlanMealEntrySchema } from "../shared/meal-entry";
import { IdSchema, IsoDateSchema } from "../shared/primitives";

export const MealSlotSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  sortOrder: z.number().finite().int(),
  isDefault: z.boolean(),
});
export type MealSlot = z.infer<typeof MealSlotSchema>;

export const PlannedMealSchema = z.object({
  id: IdSchema,
  date: IsoDateSchema,
  slotId: IdSchema,
  entry: PlanMealEntrySchema,
  position: z.number().finite().int(),
  note: z.string().nullable(),
});
export type PlannedMeal = z.infer<typeof PlannedMealSchema>;

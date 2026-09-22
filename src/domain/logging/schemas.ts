import { z } from "zod";
import { MealEntrySchema } from "../shared/meal-entry";
import { IdSchema, IsoDateSchema, IsoDateTimeSchema } from "../shared/primitives";

export const LoggedMealSchema = z.object({
  id: IdSchema,
  date: IsoDateSchema,
  slotId: IdSchema,
  entry: MealEntrySchema,
  plannedMealId: IdSchema.nullable(),
  loggedAt: IsoDateTimeSchema,
  note: z.string().nullable(),
});
export type LoggedMeal = z.infer<typeof LoggedMealSchema>;

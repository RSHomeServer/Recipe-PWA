import { z } from "zod";
import { MealEntrySchema } from "../shared/meal-entry";
import { IdSchema, IsoDateSchema, IsoDateTimeSchema } from "../shared/primitives";
import { PlanGroupSchema } from "../meals/schemas";

export const LoggedMealSchema = z.object({
  id: IdSchema,
  date: IsoDateSchema,
  slotId: IdSchema,
  entry: MealEntrySchema,
  plannedMealId: IdSchema.nullable(),
  loggedAt: IsoDateTimeSchema,
  note: z.string().nullable(),
  /** Display-only; copied from plan when logging a group (ADR-004). */
  group: PlanGroupSchema.nullable(),
});
export type LoggedMeal = z.infer<typeof LoggedMealSchema>;

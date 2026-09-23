import type { MealEntry } from "../shared/meal-entry";
import type {
  Id,
  IsoDate,
  IsoDateTime,
} from "../shared/primitives";
import type { PlannedMeal } from "../planning/schemas";
import type { LoggedMeal } from "./schemas";

export type LogFromPlanOptions = {
  id: Id;
  loggedAt: IsoDateTime;
  /** Override copied entry (e.g. log 1.5 when plan was 1). */
  entry?: MealEntry;
  date?: IsoDate;
  slotId?: Id;
  note?: string | null;
};

/**
 * Build a LoggedMeal from a PlannedMeal.
 * Copies entry and sets plannedMealId — the plan is never modified.
 */
export function logFromPlan(
  planned: PlannedMeal,
  options: LogFromPlanOptions,
): LoggedMeal {
  return {
    id: options.id,
    date: options.date ?? planned.date,
    slotId: options.slotId ?? planned.slotId,
    entry: options.entry ?? planned.entry,
    plannedMealId: planned.id,
    loggedAt: options.loggedAt,
    note: options.note !== undefined ? options.note : planned.note,
  };
}

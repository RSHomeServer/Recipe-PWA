import type { RecipeRepositories } from "@/data/repos/types";
import {
  createId,
  type PlanMealEntry,
  type PlannedMeal,
} from "@/domain";

/** Append a plan row after anything already in that date/slot. */
export async function appendPlannedMeal(
  repos: RecipeRepositories,
  input: {
    date: string;
    slotId: string;
    entry: PlanMealEntry;
    note?: string | null;
  },
): Promise<PlannedMeal> {
  const existing = (await repos.plannedMeals.all()).filter(
    (m) => m.date === input.date && m.slotId === input.slotId,
  );
  const position =
    existing.reduce((max, m) => Math.max(max, m.position), -1) + 1;
  const row: PlannedMeal = {
    id: createId(),
    date: input.date,
    slotId: input.slotId,
    entry: input.entry,
    position,
    note: input.note ?? null,
    group: null,
  };
  await repos.plannedMeals.put(row);
  return row;
}

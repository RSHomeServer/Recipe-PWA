import type { PlannedMeal } from "../planning/schemas";
import { createId, type Id, type IsoDate } from "../shared/primitives";
import type { MealTemplate, PlanGroup } from "./schemas";

export type ExpandTemplateOptions = {
  template: MealTemplate;
  dates: readonly IsoDate[];
  slotId: Id;
  /** Existing planned meals (used to append after anything already in each slot). */
  existing: readonly PlannedMeal[];
  /** Override id factory (tests). Defaults to `createId`. */
  nextId?: () => Id;
};

/**
 * Expand a meal template onto selected days (ADR-004 §3).
 *
 * One `PlannedMeal` per component per day, sharing a fresh `group.id` per day,
 * in component order, positioned after anything already in that slot.
 * Does not mutate `existing` or the template.
 */
export function expandTemplateToPlannedMeals(
  options: ExpandTemplateOptions,
): PlannedMeal[] {
  const { template, dates, slotId, existing } = options;
  if (template.components.length === 0) {
    throw new Error("Meal template has no components");
  }
  if (dates.length === 0) {
    throw new Error("Select at least one day");
  }

  const nextId = options.nextId ?? createId;
  const created: PlannedMeal[] = [];

  for (const date of dates) {
    const group: PlanGroup = {
      id: nextId(),
      name: template.name,
      templateId: template.id,
    };
    const slotMeals = existing.filter(
      (m) => m.date === date && m.slotId === slotId,
    );
    let nextPosition =
      slotMeals.reduce((max, m) => Math.max(max, m.position), -1) + 1;

    for (const component of template.components) {
      created.push({
        id: nextId(),
        date,
        slotId,
        entry: component.entry,
        position: nextPosition,
        note: component.note,
        group,
      });
      nextPosition += 1;
    }
  }

  return created;
}

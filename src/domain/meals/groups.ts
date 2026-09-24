import type { PlannedMeal } from "../planning/schemas";
import type { LoggedMeal } from "../logging/schemas";

/** Clear display-only `group` on every row (for R4.3 invariance checks). */
export function clearPlanGroups(
  meals: readonly PlannedMeal[],
): PlannedMeal[] {
  return meals.map((m) => (m.group == null ? m : { ...m, group: null }));
}

export function clearLogGroups(meals: readonly LoggedMeal[]): LoggedMeal[] {
  return meals.map((m) => (m.group == null ? m : { ...m, group: null }));
}

export type SlotRenderItem =
  | { kind: "single"; meal: PlannedMeal }
  | {
      kind: "group";
      groupId: string;
      name: string;
      templateId: string | null;
      meals: PlannedMeal[];
    };

/**
 * Collapse consecutive meals that share a `group.id` into one tile item.
 * Ungrouped meals (and meals whose neighbours have a different group) stay singles.
 * Order follows `position` (then id).
 */
export function partitionSlotMeals(
  meals: readonly PlannedMeal[],
): SlotRenderItem[] {
  const sorted = [...meals].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );
  const items: SlotRenderItem[] = [];
  let i = 0;
  while (i < sorted.length) {
    const meal = sorted[i]!;
    const groupId = meal.group?.id ?? null;
    if (!groupId || !meal.group) {
      items.push({ kind: "single", meal });
      i += 1;
      continue;
    }
    const members: PlannedMeal[] = [meal];
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.group?.id === groupId) {
      members.push(sorted[j]!);
      j += 1;
    }
    if (members.length === 1) {
      items.push({ kind: "single", meal });
    } else {
      items.push({
        kind: "group",
        groupId,
        name: meal.group.name,
        templateId: meal.group.templateId,
        meals: members,
      });
    }
    i = j;
  }
  return items;
}

/** All planned meals that share `groupId` (any slot/date). */
export function mealsInGroup(
  all: readonly PlannedMeal[],
  groupId: string,
): PlannedMeal[] {
  return all
    .filter((m) => m.group?.id === groupId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** Clear `group` on every member of a group (R4.8 Ungroup). */
export function ungroupMeals(
  all: readonly PlannedMeal[],
  groupId: string,
): PlannedMeal[] {
  return all
    .filter((m) => m.group?.id === groupId)
    .map((m) => ({ ...m, group: null }));
}

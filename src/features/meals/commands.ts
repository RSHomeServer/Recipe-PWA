import type { RecipeRepositories } from "@/data/repos/types";
import {
  expandTemplateToPlannedMeals,
  mealsInGroup,
  ungroupMeals,
  type Id,
  type IsoDate,
  type MealTemplate,
  type PlannedMeal,
} from "@/domain";
import { createLogFromPlan } from "@/features/log/commands";
import { movePlannedMeal, withDensePositions } from "@/features/plan/reorder";

export async function applyMealTemplate(
  repos: RecipeRepositories,
  input: {
    template: MealTemplate;
    dates: readonly IsoDate[];
    slotId: Id;
  },
): Promise<PlannedMeal[]> {
  const existing = await repos.plannedMeals.all();
  const rows = expandTemplateToPlannedMeals({
    template: input.template,
    dates: input.dates,
    slotId: input.slotId,
    existing,
  });
  await Promise.all(rows.map((row) => repos.plannedMeals.put(row)));
  return rows;
}

export async function logAllInGroup(
  repos: RecipeRepositories,
  allPlanned: readonly PlannedMeal[],
  groupId: string,
): Promise<void> {
  const members = mealsInGroup(allPlanned, groupId);
  for (const planned of members) {
    await createLogFromPlan(repos, planned);
  }
}

export async function removeAllInGroup(
  repos: RecipeRepositories,
  allPlanned: readonly PlannedMeal[],
  groupId: string,
): Promise<void> {
  const members = mealsInGroup(allPlanned, groupId);
  if (members.length === 0) return;
  const date = members[0]!.date;
  const slotId = members[0]!.slotId;
  const removeIds = new Set(members.map((m) => m.id));
  await Promise.all([...removeIds].map((id) => repos.plannedMeals.delete(id)));
  const remaining = allPlanned
    .filter((m) => m.date === date && m.slotId === slotId && !removeIds.has(m.id))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const densified = withDensePositions(remaining);
  await Promise.all(
    densified
      .filter((m, i) => remaining[i]!.position !== m.position)
      .map((m) => repos.plannedMeals.put(m)),
  );
}

export async function ungroupPlanGroup(
  repos: RecipeRepositories,
  allPlanned: readonly PlannedMeal[],
  groupId: string,
): Promise<void> {
  const updates = ungroupMeals(allPlanned, groupId);
  await Promise.all(updates.map((row) => repos.plannedMeals.put(row)));
}

/**
 * Move every member of a group to a target date/slot, preserving relative order,
 * appended starting at `targetIndex` among non-members already in the slot.
 */
export async function moveAllInGroup(
  repos: RecipeRepositories,
  allPlanned: readonly PlannedMeal[],
  groupId: string,
  targetDate: IsoDate,
  targetSlotId: Id,
  targetIndex?: number,
): Promise<void> {
  const members = mealsInGroup(allPlanned, groupId);
  if (members.length === 0) return;

  let working = [...allPlanned];
  const nonMembersInTarget = working.filter(
    (m) =>
      m.date === targetDate &&
      m.slotId === targetSlotId &&
      m.group?.id !== groupId,
  ).length;
  let index = targetIndex ?? nonMembersInTarget;

  for (const member of members) {
    const updates = movePlannedMeal(
      working,
      member.id,
      targetDate,
      targetSlotId,
      index,
    );
    const byId = new Map(working.map((m) => [m.id, m]));
    for (const u of updates) byId.set(u.id, u);
    working = [...byId.values()];
    index += 1;
  }

  const changed = working.filter((m) => {
    const prev = allPlanned.find((p) => p.id === m.id);
    return (
      !prev ||
      prev.date !== m.date ||
      prev.slotId !== m.slotId ||
      prev.position !== m.position
    );
  });
  await Promise.all(changed.map((row) => repos.plannedMeals.put(row)));
}

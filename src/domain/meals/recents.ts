import type { LoggedMeal } from "../logging/schemas";
import type { PlannedMeal } from "../planning/schemas";
import type { MealEntry, PlanMealEntry } from "../shared/meal-entry";
import { createId } from "../shared/primitives";
import type { MealTemplateComponent, MealTemplateEntry } from "./schemas";

/** Cap matches ADR-004 §5 / R4.10. */
export const RECENTS_LIMIT = 12;

/**
 * Stable identity for dedupe: `kind` + target id (ADR-004 §5).
 * `customFood` has no target id — excluded from recents.
 */
export function entryIdentityKey(
  entry: MealEntry | PlanMealEntry,
): string | null {
  switch (entry.kind) {
    case "recipeServings":
      return `recipeServings:${entry.recipeId}`;
    case "batchPortions":
      return `batchPortions:${entry.batchId}`;
    case "ingredient":
      return `ingredient:${entry.ingredientId}`;
    case "customFood":
      return null;
  }
}

export type RecentEntry = {
  identityKey: string;
  /** Quantities from the most recent occurrence. */
  entry: PlanMealEntry;
};

type TimedOccurrence = {
  at: string;
  tie: number;
  entry: PlanMealEntry;
  identityKey: string;
};

function asPlanEntry(entry: MealEntry): PlanMealEntry | null {
  if (entry.kind === "customFood") return null;
  return entry;
}

/**
 * Derive up to `limit` distinct recent plan/log entries, most recent first.
 * Pure — never stores. Planned meals use end-of-day on `date` as the sort
 * instant; logged meals use `loggedAt`.
 */
export function deriveRecents(
  planned: readonly PlannedMeal[],
  logged: readonly LoggedMeal[],
  limit: number = RECENTS_LIMIT,
): RecentEntry[] {
  const events: TimedOccurrence[] = [];

  for (const meal of planned) {
    const identityKey = entryIdentityKey(meal.entry);
    if (!identityKey) continue;
    events.push({
      at: `${meal.date}T23:59:59.999Z`,
      tie: meal.position,
      entry: meal.entry,
      identityKey,
    });
  }

  for (const meal of logged) {
    const planEntry = asPlanEntry(meal.entry);
    if (!planEntry) continue;
    const identityKey = entryIdentityKey(planEntry);
    if (!identityKey) continue;
    events.push({
      at: meal.loggedAt,
      tie: 0,
      entry: planEntry,
      identityKey,
    });
  }

  events.sort(
    (a, b) => b.at.localeCompare(a.at) || b.tie - a.tie || a.identityKey.localeCompare(b.identityKey),
  );

  const seen = new Set<string>();
  const out: RecentEntry[] = [];
  for (const event of events) {
    if (seen.has(event.identityKey)) continue;
    seen.add(event.identityKey);
    out.push({ identityKey: event.identityKey, entry: event.entry });
    if (out.length >= limit) break;
  }
  return out;
}

/** Ungrouped rows in a slot, position order. */
export function ungroupedMealsInSlot(
  meals: readonly PlannedMeal[],
): PlannedMeal[] {
  return meals
    .filter((m) => m.group == null)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function asTemplateEntry(entry: PlanMealEntry): MealTemplateEntry | null {
  if (entry.kind === "batchPortions") return null;
  return entry;
}

/**
 * R4.11 — two or more ungrouped entries that can become template components
 * (recipeServings / ingredient). Batch-only slots do not qualify.
 */
export function canSaveSlotAsMeal(meals: readonly PlannedMeal[]): boolean {
  const eligible = ungroupedMealsInSlot(meals)
    .map((m) => asTemplateEntry(m.entry))
    .filter((e): e is MealTemplateEntry => e != null);
  return eligible.length >= 2;
}

/**
 * Prefill for the meal template editor from a slot's ungrouped rows.
 * Skips batchPortions (templates cannot reference batches).
 */
export function mealTemplatePrefillFromSlot(
  meals: readonly PlannedMeal[],
  defaultSlotId: string,
): { components: MealTemplateComponent[]; defaultSlotId: string } | null {
  if (!canSaveSlotAsMeal(meals)) return null;
  const components: MealTemplateComponent[] = [];
  for (const meal of ungroupedMealsInSlot(meals)) {
    const entry = asTemplateEntry(meal.entry);
    if (!entry) continue;
    components.push({
      id: createId(),
      entry,
      note: meal.note,
    });
  }
  if (components.length < 2) return null;
  return { components, defaultSlotId };
}

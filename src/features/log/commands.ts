import type { RecipeRepositories } from "@/data/repos/types";
import {
  applyPantryOnLogCreate,
  applyPantryOnLogReverse,
  createId,
  logFromPlan,
  pantrySideEffectForEntry,
  type LoggedMeal,
  type MealEntry,
  type PlannedMeal,
} from "@/domain";

async function writePantryCreate(
  repos: RecipeRepositories,
  entry: MealEntry,
  updatedAt: string,
): Promise<void> {
  const effect = pantrySideEffectForEntry(entry);
  if (effect.kind === "none") return;
  const ingredient = await repos.ingredients.byId(effect.ingredientId);
  const existing =
    (await repos.pantryStock.byIngredientId(effect.ingredientId)) ?? undefined;
  const result = applyPantryOnLogCreate(
    effect,
    existing,
    ingredient,
    updatedAt,
  );
  if (!result.ok) {
    throw new Error("Could not update pantry for this log");
  }
  if (result.stock) {
    await repos.pantryStock.put(result.stock);
  }
}

async function writePantryReverse(
  repos: RecipeRepositories,
  entry: MealEntry,
  updatedAt: string,
): Promise<void> {
  const effect = pantrySideEffectForEntry(entry);
  if (effect.kind === "none") return;
  const ingredient = await repos.ingredients.byId(effect.ingredientId);
  const existing =
    (await repos.pantryStock.byIngredientId(effect.ingredientId)) ?? undefined;
  const result = applyPantryOnLogReverse(
    effect,
    existing,
    ingredient,
    updatedAt,
  );
  if (!result.ok) {
    throw new Error("Could not reverse pantry for this log");
  }
  if (result.stock) {
    await repos.pantryStock.put(result.stock);
  }
}

export async function createLoggedMeal(
  repos: RecipeRepositories,
  input: {
    date: string;
    slotId: string;
    entry: MealEntry;
    plannedMealId?: string | null;
    note?: string | null;
  },
): Promise<LoggedMeal> {
  const loggedAt = new Date().toISOString();
  const row: LoggedMeal = {
    id: createId(),
    date: input.date,
    slotId: input.slotId,
    entry: input.entry,
    plannedMealId: input.plannedMealId ?? null,
    loggedAt,
    note: input.note ?? null,
  };
  await writePantryCreate(repos, row.entry, loggedAt);
  await repos.loggedMeals.put(row);
  return row;
}

export async function createLogFromPlan(
  repos: RecipeRepositories,
  planned: PlannedMeal,
  overrides?: {
    entry?: MealEntry;
    note?: string | null;
  },
): Promise<LoggedMeal> {
  const loggedAt = new Date().toISOString();
  const row = logFromPlan(planned, {
    id: createId(),
    loggedAt,
    entry: overrides?.entry,
    note: overrides?.note,
  });
  await writePantryCreate(repos, row.entry, loggedAt);
  await repos.loggedMeals.put(row);
  return row;
}

export async function updateLoggedMeal(
  repos: RecipeRepositories,
  previous: LoggedMeal,
  next: Omit<LoggedMeal, "id" | "loggedAt"> & { loggedAt?: string },
): Promise<LoggedMeal> {
  const updatedAt = new Date().toISOString();
  await writePantryReverse(repos, previous.entry, updatedAt);
  await writePantryCreate(repos, next.entry, updatedAt);
  const row: LoggedMeal = {
    id: previous.id,
    loggedAt: next.loggedAt ?? previous.loggedAt,
    date: next.date,
    slotId: next.slotId,
    entry: next.entry,
    plannedMealId: next.plannedMealId,
    note: next.note,
  };
  await repos.loggedMeals.put(row);
  return row;
}

export async function deleteLoggedMeal(
  repos: RecipeRepositories,
  row: LoggedMeal,
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await writePantryReverse(repos, row.entry, updatedAt);
  await repos.loggedMeals.delete(row.id);
}

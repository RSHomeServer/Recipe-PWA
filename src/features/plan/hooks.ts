import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import {
  requirements,
  type DateRange,
  type PlannedMeal,
  type MealSlot,
  type Recipe,
  type Ingredient,
  type PlanRequirementLine,
} from "@/domain";

export function useMealSlots() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<MealSlot[] | undefined> => {
    if (!repos) return undefined;
    const rows = await repos.mealSlots.all();
    return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [repos]);
}

export function usePlannedMeals() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<PlannedMeal[] | undefined> => {
    if (!repos) return undefined;
    return repos.plannedMeals.all();
  }, [repos]);
}

export function useRecipesForPlan() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<Recipe[] | undefined> => {
    if (!repos) return undefined;
    const rows = await repos.recipes.all();
    return rows
      .filter((r) => r.archivedAt == null)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }, [repos]);
}

export function useIngredientsForPlan() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<Ingredient[] | undefined> => {
    if (!repos) return undefined;
    const rows = await repos.ingredients.all();
    return rows
      .filter((r) => r.archivedAt == null)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }, [repos]);
}

export function usePlanRequirements(
  meals: PlannedMeal[] | undefined,
  range: DateRange,
  recipes: Recipe[] | undefined,
  ingredients: Ingredient[] | undefined,
): PlanRequirementLine[] | undefined {
  return useMemo(() => {
    if (!meals || !recipes || !ingredients) return undefined;
    return requirements(meals, range, {
      recipesById: new Map(recipes.map((r) => [r.id, r])),
      ingredientsById: new Map(ingredients.map((i) => [i.id, i])),
    });
  }, [meals, range, recipes, ingredients]);
}

export function mealsInRange(
  meals: readonly PlannedMeal[],
  range: DateRange,
): PlannedMeal[] {
  return meals.filter((m) => m.date >= range.from && m.date <= range.to);
}

export function mealsForSlot(
  meals: readonly PlannedMeal[],
  date: string,
  slotId: string,
): PlannedMeal[] {
  return meals
    .filter((m) => m.date === date && m.slotId === slotId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

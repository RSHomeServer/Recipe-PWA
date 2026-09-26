import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import {
  expandAll,
  expandCtxFromMaps,
  byDay,
  byMeal,
  byRecipe,
  byIngredient,
  eachDateInRange,
  rankTop,
  totalNutrition,
  weeklyAverage,
  weekContaining,
  type Contribution,
  type FoldBucket,
  type LoggedMeal,
  type MealSlot,
  type Recipe,
  type Batch,
  type Ingredient,
} from "@/domain";
import { useBatches, useLoggedMeals } from "@/features/cook/hooks";
import { useIngredients } from "@/features/ingredients/hooks";
import { useMealSlots } from "@/features/plan/hooks";
import { useRecipes } from "@/features/recipes/hooks";
import { useSettings } from "@/features/shopping/hooks";

export type InsightsData = {
  logs: LoggedMeal[];
  contributions: Contribution[];
  today: string;
  weekRange: { from: string; to: string };
  weekDates: string[];
  todayNutrition: ReturnType<typeof totalNutrition>;
  weekContributions: Contribution[];
  weekByDay: FoldBucket[];
  weekAverage: ReturnType<typeof weeklyAverage>;
  byMealBuckets: FoldBucket[];
  byRecipeRanked: ReturnType<typeof rankTop>;
  byIngredientRanked: ReturnType<typeof rankTop>;
  slotsById: Map<string, MealSlot>;
  recipesById: Map<string, Recipe>;
  target: number | null;
};

export function useInsightsData(today: string): InsightsData | undefined {
  const logs = useLoggedMeals();
  const recipes = useRecipes();
  const ingredients = useIngredients();
  const batches = useBatches();
  const slots = useMealSlots();
  const settings = useSettings();

  return useMemo(() => {
    if (
      logs === undefined ||
      recipes === undefined ||
      ingredients === undefined ||
      batches === undefined ||
      slots === undefined ||
      settings === undefined
    ) {
      return undefined;
    }

    const recipesById = new Map(recipes.map((r) => [r.id, r]));
    const batchesById = new Map(batches.map((b) => [b.id, b]));
    const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
    const slotsById = new Map(slots.map((s) => [s.id, s]));
    const ctx = expandCtxFromMaps(recipesById, batchesById, ingredientsById);

    const weekRange = weekContaining(today, settings.weekStartsOn);
    const weekDates = eachDateInRange(weekRange);
    const weekSet = new Set(weekDates);

    const contributions = expandAll(logs, ctx);
    const weekContributions = contributions.filter((c) =>
      weekSet.has(c.source.date),
    );
    const todayContributions = contributions.filter(
      (c) => c.source.date === today,
    );

    const dayBuckets = byDay(weekContributions);
    const dayByKey = new Map(dayBuckets.map((b) => [b.key, b]));
    const weekByDay: FoldBucket[] = weekDates.map((date) => {
      const existing = dayByKey.get(date);
      return (
        existing ?? {
          key: date,
          label: date,
          nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 },
        }
      );
    });

    const mealBuckets = byMeal(weekContributions);
    const orderedMeals = [...slots]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((slot) => {
        const found = mealBuckets.find((b) => b.key === slot.id);
        return (
          found ?? {
            key: slot.id,
            label: slot.name,
            nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0 },
          }
        );
      })
      .map((b) => ({
        ...b,
        label: slotsById.get(b.key)?.name ?? b.label,
      }));

    const recipeBuckets = byRecipe(weekContributions).map((b) => ({
      ...b,
      label:
        b.key === "__none__"
          ? "No recipe"
          : (recipesById.get(b.key)?.name ?? b.label),
    }));

    return {
      logs,
      contributions,
      today,
      weekRange,
      weekDates,
      todayNutrition: totalNutrition(todayContributions),
      weekContributions,
      weekByDay,
      weekAverage: weeklyAverage(weekContributions),
      byMealBuckets: orderedMeals,
      byRecipeRanked: rankTop(recipeBuckets, 8),
      byIngredientRanked: rankTop(byIngredient(weekContributions), 10, {
        keepUnattributed: true,
      }),
      slotsById,
      recipesById,
      target: settings.dailyCalorieTarget,
    };
  }, [logs, recipes, ingredients, batches, slots, settings, today]);
}

/** Lightweight hook when only settings + today's logs matter (Today page). */
export function useTodayConsumedKcal(today: string): number | undefined {
  const repos = useRepos();
  const settingsReady = useSettings();
  const recipes = useRecipes();
  const ingredients = useIngredients();
  const batches = useBatches();

  const dayLogs = useLiveQuery(async (): Promise<LoggedMeal[] | undefined> => {
    if (!repos) return undefined;
    return repos.loggedMeals.byDate(today);
  }, [repos, today]);

  return useMemo(() => {
    if (
      dayLogs === undefined ||
      recipes === undefined ||
      ingredients === undefined ||
      batches === undefined ||
      settingsReady === undefined
    ) {
      return undefined;
    }
    const ctx = expandCtxFromMaps(
      new Map(recipes.map((r: Recipe) => [r.id, r])),
      new Map(batches.map((b: Batch) => [b.id, b])),
      new Map(ingredients.map((i: Ingredient) => [i.id, i])),
    );
    return totalNutrition(expandAll(dayLogs, ctx)).kcal;
  }, [dayLogs, recipes, ingredients, batches, settingsReady]);
}

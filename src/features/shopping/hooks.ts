import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import {
  shoppingList,
  type Ingredient,
  type IngredientCategory,
  type PlannedMeal,
  type Recipe,
  type Settings,
  type ShoppingListLine,
  type ShoppingOverlay,
  type ShoppingWindow,
  type PantryStock,
} from "@/domain";
import { usePlanRequirements } from "@/features/plan/hooks";

export function useSettings() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<Settings | undefined> => {
    if (!repos) return undefined;
    return repos.settings.get();
  }, [repos]);
}

export function useShoppingOverlay(window: ShoppingWindow | undefined) {
  const repos = useRepos();
  const key = window ? `${window.from}_${window.to}` : undefined;
  return useLiveQuery(async (): Promise<ShoppingOverlay | null | undefined> => {
    if (!repos || !key) return undefined;
    return (await repos.shoppingOverlays.byWindowKey(key)) ?? null;
  }, [repos, key]);
}

export function useShoppingDerivedLines(
  meals: PlannedMeal[] | undefined,
  window: ShoppingWindow | undefined,
  recipes: Recipe[] | undefined,
  ingredients: Ingredient[] | undefined,
  pantry: PantryStock[] | undefined,
  overlay: ShoppingOverlay | null | undefined,
): ShoppingListLine[] | undefined {
  const requirements = usePlanRequirements(
    meals,
    window ?? { from: "1970-01-01", to: "1970-01-01" },
    recipes,
    ingredients,
  );

  return useMemo(() => {
    if (!window || !requirements || !pantry || overlay === undefined) {
      return undefined;
    }
    return shoppingList(requirements, pantry, overlay);
  }, [window, requirements, pantry, overlay]);
}

export type ShoppingLineView = ShoppingListLine & {
  ingredient: Ingredient;
  category: IngredientCategory | null;
};

export function useShoppingLineViews(
  lines: ShoppingListLine[] | undefined,
  ingredients: Ingredient[] | undefined,
  categories: IngredientCategory[] | undefined,
): ShoppingLineView[] | undefined {
  return useMemo(() => {
    if (!lines || !ingredients || !categories) return undefined;
    const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const views: ShoppingLineView[] = [];
    for (const line of lines) {
      const ingredient = ingredientsById.get(line.ingredientId);
      if (!ingredient || ingredient.archivedAt != null) continue;
      const category =
        ingredient.categoryId != null
          ? (categoriesById.get(ingredient.categoryId) ?? null)
          : null;
      views.push({ ...line, ingredient, category });
    }
    return views;
  }, [lines, ingredients, categories]);
}

export function useIngredientCategories() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<IngredientCategory[] | undefined> => {
    if (!repos) return undefined;
    const rows = await repos.ingredientCategories.all();
    return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [repos]);
}

export function usePantryStockAll() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<PantryStock[] | undefined> => {
    if (!repos) return undefined;
    return repos.pantryStock.all();
  }, [repos]);
}

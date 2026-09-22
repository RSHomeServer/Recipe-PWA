import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import {
  availabilityForAll,
  formatShortfallLabels,
  type Availability,
  type Ingredient,
  type IngredientCategory,
  type PantryStock,
  type Recipe,
} from "@/domain";

export function usePantryStock() {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos) return undefined;
    return repos.pantryStock.all();
  }, [repos]);
}

export function usePantryStockByIngredientId() {
  const stock = usePantryStock();
  return useMemo(() => {
    if (!stock) return undefined;
    return new Map(stock.map((row) => [row.ingredientId, row]));
  }, [stock]);
}

export type PantryStockRow = {
  ingredient: Ingredient;
  stock: PantryStock;
  category: IngredientCategory | null;
};

/** Joined pantry rows for the stock list, sorted by category then name. */
export function usePantryStockRows() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<PantryStockRow[] | undefined> => {
    if (!repos) return undefined;
    const [stock, ingredients, categories] = await Promise.all([
      repos.pantryStock.all(),
      repos.ingredients.all(),
      repos.ingredientCategories.all(),
    ]);
    const ingredientsById = new Map(ingredients.map((row) => [row.id, row]));
    const categoriesById = new Map(categories.map((row) => [row.id, row]));

    const rows: PantryStockRow[] = [];
    for (const row of stock) {
      const ingredient = ingredientsById.get(row.ingredientId);
      if (!ingredient || ingredient.archivedAt != null) continue;
      const category =
        ingredient.categoryId != null
          ? (categoriesById.get(ingredient.categoryId) ?? null)
          : null;
      rows.push({ ingredient, stock: row, category });
    }

    rows.sort((a, b) => {
      const catA = a.category?.sortOrder ?? Number.POSITIVE_INFINITY;
      const catB = b.category?.sortOrder ?? Number.POSITIVE_INFINITY;
      if (catA !== catB) return catA - catB;
      const nameA = a.category?.name ?? "Uncategorized";
      const nameB = b.category?.name ?? "Uncategorized";
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      }
      return a.ingredient.name.localeCompare(b.ingredient.name, undefined, {
        sensitivity: "base",
      });
    });
    return rows;
  }, [repos]);
}

export type RecipeAvailabilityRow = {
  recipe: Recipe;
  availability: Availability;
  shortfallLabels: string[];
};

export function useRecipeAvailabilityRows() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<RecipeAvailabilityRow[] | undefined> => {
    if (!repos) return undefined;
    const [recipes, stock, ingredients] = await Promise.all([
      repos.recipes.all(),
      repos.pantryStock.all(),
      repos.ingredients.all(),
    ]);
    const ingredientsById = new Map(ingredients.map((row) => [row.id, row]));
    const recipesById = new Map(recipes.map((row) => [row.id, row]));
    const derived = availabilityForAll(recipes, stock, ingredients);

    const statusOrder: Record<Availability["status"], number> = {
      canMake: 0,
      almostCanMake: 1,
      missingSignificant: 2,
    };

    return derived
      .map((entry) => {
        const recipe = recipesById.get(entry.recipeId);
        if (!recipe) return null;
        return {
          recipe,
          availability: entry.availability,
          shortfallLabels: formatShortfallLabels(
            entry.availability.shortfalls,
            ingredientsById,
          ),
        };
      })
      .filter((row): row is RecipeAvailabilityRow => row != null)
      .sort((a, b) => {
        const byStatus =
          statusOrder[a.availability.status] -
          statusOrder[b.availability.status];
        if (byStatus !== 0) return byStatus;
        return a.recipe.name.localeCompare(b.recipe.name, undefined, {
          sensitivity: "base",
        });
      });
  }, [repos]);
}

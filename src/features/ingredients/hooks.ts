import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import { isIngredientReferenced } from "@/domain";

export function useIngredientCategories() {
  const repos = useRepos();
  return useLiveQuery(
    async () => {
      if (!repos) return undefined;
      const rows = await repos.ingredientCategories.all();
      return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [repos],
  );
}

export function useIngredients() {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos) return undefined;
    const rows = await repos.ingredients.all();
    return [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [repos]);
}

/** `undefined` while loading; `null` when the id is missing from the database. */
export function useIngredient(id: string | undefined) {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos || !id || id === "new") return undefined;
    const row = await repos.ingredients.byId(id);
    return row ?? null;
  }, [repos, id]);
}

export function useIngredientMeasureKindLocked(ingredientId: string | undefined) {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos || !ingredientId || ingredientId === "new") return false;
    const [recipes, pantry, plannedMeals, loggedMeals] = await Promise.all([
      repos.recipes.all(),
      repos.pantryStock.all(),
      repos.plannedMeals.all(),
      repos.loggedMeals.all(),
    ]);
    return isIngredientReferenced(ingredientId, {
      recipes,
      pantry,
      plannedMeals,
      loggedMeals,
    });
  }, [repos, ingredientId]);
}

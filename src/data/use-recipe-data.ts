import { useContext } from "react";
import {
  RecipeDataContext,
  type RecipeDataValue,
} from "./recipe-data-context";
import type { RecipeRepositories } from "./repos/types";

export function useRecipeData(): RecipeDataValue {
  const ctx = useContext(RecipeDataContext);
  if (!ctx) {
    throw new Error("useRecipeData must be used within RecipeDataProvider");
  }
  return ctx;
}

export function useRepos(): RecipeRepositories | null {
  return useRecipeData().repos;
}

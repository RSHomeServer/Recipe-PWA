import { createContext } from "react";
import type Dexie from "dexie";
import type { RecipeRepositories } from "./repos/types";

export type RecipeDataValue = {
  db: Dexie | null;
  repos: RecipeRepositories | null;
  ready: boolean;
  error: Error | null;
};

export const RecipeDataContext = createContext<RecipeDataValue | null>(null);

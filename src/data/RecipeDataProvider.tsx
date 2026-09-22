import { useEffect, useMemo, useState, type ReactNode } from "react";
import type Dexie from "dexie";
import { createDexieRepositories } from "./repos/dexie";
import { openRecipeDb } from "./db";
import {
  RecipeDataContext,
  type RecipeDataValue,
} from "./recipe-data-context";

export function RecipeDataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Dexie | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    void openRecipeDb()
      .then((opened) => {
        if (!cancelled) setDb(opened);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<RecipeDataValue>(() => {
    const repos = db ? createDexieRepositories(db) : null;
    return {
      db,
      repos,
      ready: db != null,
      error,
    };
  }, [db, error]);

  return (
    <RecipeDataContext.Provider value={value}>
      {children}
    </RecipeDataContext.Provider>
  );
}

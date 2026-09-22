import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import {
  isBatchAvailable,
  portionsRemainingDisplay,
  type Batch,
  type LoggedMeal,
} from "@/domain";

export function useBatches() {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos) return undefined;
    const rows = await repos.batches.all();
    return [...rows].sort((a, b) => b.cookedAt.localeCompare(a.cookedAt));
  }, [repos]);
}

/** `undefined` while loading; `null` when missing. */
export function useBatch(id: string | undefined) {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos || !id) return undefined;
    const row = await repos.batches.byId(id);
    return row ?? null;
  }, [repos, id]);
}

export function useLoggedMeals() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<LoggedMeal[] | undefined> => {
    if (!repos) return undefined;
    return repos.loggedMeals.all();
  }, [repos]);
}

export type BatchListRow = {
  batch: Batch;
  remaining: number;
  available: boolean;
};

export function useBatchListRows(): BatchListRow[] | undefined {
  const batches = useBatches();
  const logs = useLoggedMeals();

  return useMemo(() => {
    if (batches === undefined || logs === undefined) return undefined;
    return batches.map((batch) => ({
      batch,
      remaining: portionsRemainingDisplay(batch, logs),
      available: isBatchAvailable(batch, logs),
    }));
  }, [batches, logs]);
}

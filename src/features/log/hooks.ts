import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import type { LoggedMeal } from "@/domain";

export function useLoggedMealsForDate(date: string | undefined) {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<LoggedMeal[] | undefined> => {
    if (!repos || !date) return undefined;
    const rows = await repos.loggedMeals.byDate(date);
    return [...rows].sort(
      (a, b) =>
        a.slotId.localeCompare(b.slotId) ||
        a.loggedAt.localeCompare(b.loggedAt) ||
        a.id.localeCompare(b.id),
    );
  }, [repos, date]);
}

export function logsForSlot(
  logs: readonly LoggedMeal[],
  slotId: string,
): LoggedMeal[] {
  return logs.filter((log) => log.slotId === slotId);
}

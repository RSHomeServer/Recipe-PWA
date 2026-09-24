import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import type { MealTemplate } from "@/domain";

export function useMealTemplates() {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<MealTemplate[] | undefined> => {
    if (!repos) return undefined;
    const rows = await repos.mealTemplates.all();
    return [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [repos]);
}

export function useMealTemplate(id: string | undefined) {
  const repos = useRepos();
  return useLiveQuery(async (): Promise<MealTemplate | null | undefined> => {
    if (!repos || !id) return undefined;
    return (await repos.mealTemplates.byId(id)) ?? null;
  }, [repos, id]);
}

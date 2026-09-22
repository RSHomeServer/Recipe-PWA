import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRepos } from "@/data";
import type { RecipeImage } from "@/domain";

export function useRecipes() {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos) return undefined;
    const rows = await repos.recipes.all();
    return [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [repos]);
}

/** `undefined` while loading; `null` when the id is missing from the database. */
export function useRecipe(id: string | undefined) {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos || !id || id === "new") return undefined;
    const row = await repos.recipes.byId(id);
    return row ?? null;
  }, [repos, id]);
}

export function useActiveIngredients() {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos) return undefined;
    const rows = await repos.ingredients.all();
    return [...rows]
      .filter((ingredient) => ingredient.archivedAt == null)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }, [repos]);
}

export function useIngredientsById() {
  const repos = useRepos();
  return useLiveQuery(async () => {
    if (!repos) return undefined;
    const rows = await repos.ingredients.all();
    return new Map(rows.map((row) => [row.id, row]));
  }, [repos]);
}

/** Object URL for a single recipe image; revoked when the blob changes. */
export function useRecipeImageUrl(imageId: string | null | undefined) {
  const repos = useRepos();
  const image = useLiveQuery(async (): Promise<RecipeImage | null | undefined> => {
    if (!repos || !imageId) return null;
    const row = await repos.recipeImages.byId(imageId);
    return row ?? null;
  }, [repos, imageId]);

  const url = useMemo(() => {
    if (!image?.blob) return null;
    return URL.createObjectURL(image.blob);
  }, [image]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return {
    url,
    image: image ?? null,
    loading: image === undefined && !!imageId,
  };
}

/**
 * Thumbnail URLs for a list of recipes. Monogram fallback is handled in UI;
 * only recipes with `imageId` fetch blobs.
 */
export function useRecipeThumbnailUrls(
  imageIds: readonly (string | null | undefined)[],
) {
  const repos = useRepos();
  const uniqueKey = useMemo(() => {
    const set = new Set<string>();
    for (const id of imageIds) {
      if (id) set.add(id);
    }
    return [...set].sort().join("|");
  }, [imageIds]);

  const uniqueIds = useMemo(
    () => (uniqueKey.length === 0 ? [] : uniqueKey.split("|")),
    [uniqueKey],
  );

  const images = useLiveQuery(async () => {
    if (!repos) return undefined;
    const entries = await Promise.all(
      uniqueIds.map(async (id) => {
        const row = await repos.recipeImages.byId(id);
        return [id, row] as const;
      }),
    );
    return new Map(
      entries.filter(([, row]) => row != null) as [string, RecipeImage][],
    );
  }, [repos, uniqueKey]);

  const urls = useMemo(() => {
    const next = new Map<string, string>();
    if (!images) return next;
    for (const [id, row] of images) {
      next.set(id, URL.createObjectURL(row.blob));
    }
    return next;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const objectUrl of urls.values()) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [urls]);

  return urls;
}

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { NutritionSummary } from "@/features/components/domain-stubs";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import {
  useActiveIngredients,
  useIngredientsById,
  useRecipeThumbnailUrls,
  useRecipes,
} from "@/features/recipes/hooks";
import { useRecipeData } from "@/data";
import {
  recipePerServing,
  type Ingredient,
  type Recipe,
} from "@/domain";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { cn } from "@/ui/lib/utils";

const listStateConfig = {
  empty: {
    title: "No recipes yet. Recipes are built from your ingredients.",
    actionLabel: "Create recipe",
  },
  loading: { rows: 5 },
  error: {
    title: "Could not load recipes",
    description: "Try again — your recipes are stored locally.",
  },
} as const;

const emptyIngredientsConfig = {
  empty: {
    title: "No recipes yet. Recipes are built from your ingredients.",
    description: "Add a few ingredients first, then come back to create recipes.",
    actionLabel: "Add ingredients first",
  },
  loading: { rows: 5 },
  error: listStateConfig.error,
} as const;

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function perServingSummary(
  recipe: Recipe,
  ingredientsById: ReadonlyMap<string, Ingredient>,
) {
  if (recipe.lines.length === 0) return null;
  try {
    return recipePerServing(recipe, Object.fromEntries(ingredientsById));
  } catch {
    return null;
  }
}

export default function RecipesPage() {
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const recipes = useRecipes();
  const activeIngredients = useActiveIngredients();
  const ingredientsById = useIngredientsById();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    if (!recipes) return undefined;
    const needle = query.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (!showArchived && recipe.archivedAt != null) return false;
      if (needle && !recipe.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [recipes, query, showArchived]);

  const imageIds = useMemo(
    () => (filtered ?? []).map((recipe) => recipe.imageId),
    [filtered],
  );
  const thumbUrls = useRecipeThumbnailUrls(imageIds);

  const goCreate = () => {
    void navigate("/recipes/new");
  };

  const goIngredients = () => {
    void navigate("/ingredients");
  };

  if (dataError) {
    return (
      <div className="app-page content">
        <PageHeader
          title="Recipes"
          description="Recipes built from your ingredients, with derived nutrition."
        />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (
    !ready ||
    recipes === undefined ||
    activeIngredients === undefined ||
    ingredientsById === undefined
  ) {
    return (
      <div className="app-page content">
        <PageHeader
          title="Recipes"
          description="Recipes built from your ingredients, with derived nutrition."
        />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  const isLibraryEmpty = recipes.length === 0;
  const noActiveIngredients = activeIngredients.length === 0;
  const isFilteredEmpty = !isLibraryEmpty && (filtered?.length ?? 0) === 0;

  return (
    <div className="app-page content">
      <PageHeader
        title="Recipes"
        description="Recipes built from your ingredients, with derived nutrition."
        actions={
          <Button type="button" onClick={goCreate} disabled={noActiveIngredients}>
            <Plus className="size-4" aria-hidden="true" />
            Create recipe
          </Button>
        }
      />

      {isLibraryEmpty ? (
        <RouteStatePanel
          state="empty"
          config={
            noActiveIngredients ? emptyIngredientsConfig : listStateConfig
          }
          onAction={noActiveIngredients ? goIngredients : goCreate}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[12rem] flex-1 space-y-2">
              <Label htmlFor="recipe-search">Search</Label>
              <Input
                id="recipe-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name"
                autoComplete="off"
              />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border border-input"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Show archived
            </label>
          </div>

          {isFilteredEmpty ? (
            <p className="text-base text-muted-foreground">
              No recipes match these filters.
            </p>
          ) : (
            <ul className="app-list-measure divide-y divide-border border-t border-border">
              {filtered?.map((recipe) => {
                const perServing = perServingSummary(recipe, ingredientsById);
                const thumb =
                  recipe.imageId != null
                    ? thumbUrls.get(recipe.imageId)
                    : undefined;
                return (
                  <li key={recipe.id}>
                    <Link
                      to={`/recipes/${recipe.id}`}
                      className="app-list-row gap-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div
                        className={cn(
                          "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-muted text-sm font-semibold text-muted-foreground",
                        )}
                        aria-hidden={thumb ? true : undefined}
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <span>{monogram(recipe.name)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-semibold text-foreground">
                            {recipe.name}
                          </span>
                          {recipe.archivedAt != null ? (
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Archived
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {recipe.servings} serving
                          {recipe.servings === 1 ? "" : "s"}
                          <span aria-hidden="true"> · </span>
                          {recipe.lines.length} ingredient
                          {recipe.lines.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="app-list-row-metrics">
                        {perServing ? (
                          <NutritionSummary
                            kcal={Math.round(perServing.kcal)}
                            protein={perServing.proteinG}
                            carbs={perServing.carbsG}
                            fat={perServing.fatG}
                            sodiumMg={perServing.sodiumMg}
                            variant="inline"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No nutrition yet
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

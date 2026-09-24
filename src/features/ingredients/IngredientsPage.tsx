import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { NutritionSummary } from "@/features/components/domain-stubs";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { IngredientIdentity } from "@/features/ingredients/IngredientIdentity";
import {
  useIngredientCategories,
  useIngredients,
} from "@/features/ingredients/hooks";
import { useRecipeThumbnailUrls } from "@/features/recipes/hooks";
import type { IngredientCategory } from "@/domain";
import { useRecipeData } from "@/data";
import { nutritionBasisLabel } from "@/domain";
import { Button } from "@/ui/button";
import { Choice } from "@/ui/choice";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

const listStateConfig = {
  empty: {
    title: "Add your first ingredient — everything else builds on these.",
    actionLabel: "Add ingredient",
  },
  loading: { rows: 5 },
  error: {
    title: "Could not load ingredients",
    description: "Local storage may be unavailable in this browser.",
  },
} as const;

export default function IngredientsPage() {
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const ingredients = useIngredients();
  const categories = useIngredientCategories();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories ?? []) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  const categoriesById = useMemo(() => {
    const map = new Map<string, IngredientCategory>();
    for (const cat of categories ?? []) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    if (!ingredients) return undefined;
    const needle = query.trim().toLowerCase();
    return ingredients.filter((ingredient) => {
      if (!showArchived && ingredient.archivedAt != null) return false;
      if (categoryFilter !== "all") {
        if (categoryFilter === "uncategorized") {
          if (ingredient.categoryId != null) return false;
        } else if (ingredient.categoryId !== categoryFilter) {
          return false;
        }
      }
      if (needle && !ingredient.name.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [ingredients, query, categoryFilter, showArchived]);

  const imageIds = useMemo(
    () => (filtered ?? []).map((ingredient) => ingredient.imageId),
    [filtered],
  );
  const thumbUrls = useRecipeThumbnailUrls(imageIds);

  const goCreate = () => {
    void navigate("/ingredients/new");
  };

  if (dataError) {
    return (
      <div className="app-page content">
        <PageHeader
          title="Ingredients"
          description="Your ingredient library — everything else builds on these."
        />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (!ready || ingredients === undefined || categories === undefined) {
    return (
      <div className="app-page content">
        <PageHeader
          title="Ingredients"
          description="Your ingredient library — everything else builds on these."
        />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  const isLibraryEmpty = ingredients.length === 0;
  const isFilteredEmpty = !isLibraryEmpty && (filtered?.length ?? 0) === 0;

  return (
    <div className="app-page content">
      <PageHeader
        title="Ingredients"
        description="Your ingredient library — everything else builds on these."
        actions={
          <Button type="button" onClick={goCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add ingredient
          </Button>
        }
      />

      {isLibraryEmpty ? (
        <RouteStatePanel
          state="empty"
          config={listStateConfig}
          onAction={goCreate}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[12rem] flex-1 space-y-2">
              <Label htmlFor="ingredient-search">Search</Label>
              <Input
                id="ingredient-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name"
                autoComplete="off"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2 sm:max-w-xl">
              <Label id="ingredient-category-filter-label">Category</Label>
              <Choice
                id="ingredient-category-filter"
                aria-labelledby="ingredient-category-filter-label"
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "uncategorized", label: "Uncategorized" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
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
              No ingredients match these filters.
            </p>
          ) : (
            <ul className="app-list-measure divide-y divide-border border-t border-border">
              {filtered?.map((ingredient) => {
                const categoryLabel =
                  ingredient.categoryId == null
                    ? "Uncategorized"
                    : (categoryName.get(ingredient.categoryId) ??
                      "Unknown category");
                return (
                  <li key={ingredient.id}>
                    <Link
                      to={`/ingredients/${ingredient.id}`}
                      className="app-list-row gap-4 py-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <IngredientIdentity
                        category={
                          ingredient.categoryId == null
                            ? undefined
                            : categoriesById.get(ingredient.categoryId)
                        }
                        imageUrl={
                          ingredient.imageId != null
                            ? thumbUrls.get(ingredient.imageId)
                            : undefined
                        }
                        name={ingredient.name}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {ingredient.name}
                          </span>
                          {ingredient.archivedAt != null ? (
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Archived
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {categoryLabel}
                          <span aria-hidden="true"> · </span>
                          {nutritionBasisLabel(ingredient.measureKind)}
                        </p>
                      </div>
                      <div className="app-list-row-metrics">
                        <NutritionSummary
                          kcal={Math.round(ingredient.nutrition.kcal)}
                          protein={ingredient.nutrition.proteinG}
                          carbs={ingredient.nutrition.carbsG}
                          fat={ingredient.nutrition.fatG}
                          variant="inline"
                        />
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

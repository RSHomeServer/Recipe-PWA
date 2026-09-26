import { useMemo } from "react";
import {
  AttributionList,
  MacroBar,
  NutritionSummary,
  Quantity,
} from "@/features/components/domain-stubs";
import {
  formatPct,
  formatQuantity,
  macroEnergyShare,
  recipeBreakdown,
  recipePerServing,
  recipeTotal,
  scaledLines,
  type Ingredient,
  type Recipe,
  type RecipeLine,
} from "@/domain";
import { cn } from "@/ui/lib/utils";

export type RecipeNutritionPanelProps = {
  recipe: Pick<Recipe, "id" | "name" | "servings" | "lines">;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  /** Preview servings for scaled line quantities (defaults to recipe.servings). */
  scaleServings?: number;
  className?: string;
};

function ingredientName(
  ingredientId: string,
  ingredientsById: ReadonlyMap<string, Ingredient>,
): string {
  return ingredientsById.get(ingredientId)?.name ?? "Unknown ingredient";
}

function macroSegments(nutrition: {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number | null;
}) {
  const protein = Math.round(macroEnergyShare(nutrition, "proteinG") * 100);
  const carbs = Math.round(macroEnergyShare(nutrition, "carbsG") * 100);
  const fat = Math.round(macroEnergyShare(nutrition, "fatG") * 100);
  return [
    { key: "protein" as const, value: protein, label: "Protein" },
    { key: "carbs" as const, value: carbs, label: "Carbs" },
    { key: "fat" as const, value: fat, label: "Fat" },
  ];
}

export function RecipeNutritionPanel({
  recipe,
  ingredientsById,
  scaleServings,
  className,
}: RecipeNutritionPanelProps) {
  const total = useMemo(() => {
    try {
      return recipeTotal(recipe, Object.fromEntries(ingredientsById));
    } catch {
      return null;
    }
  }, [recipe, ingredientsById]);

  const perServing = useMemo(() => {
    try {
      return recipePerServing(recipe, Object.fromEntries(ingredientsById));
    } catch {
      return null;
    }
  }, [recipe, ingredientsById]);

  const breakdown = useMemo(() => {
    try {
      return recipeBreakdown(recipe, Object.fromEntries(ingredientsById));
    } catch {
      return null;
    }
  }, [recipe, ingredientsById]);

  const previewServings = scaleServings ?? recipe.servings;
  const scaled = useMemo(() => {
    if (!(previewServings > 0) || previewServings === recipe.servings) {
      return recipe.lines;
    }
    return scaledLines(recipe, previewServings);
  }, [recipe, previewServings]);

  if (recipe.lines.length === 0) {
    return (
      <div className={cn("space-y-2 text-sm text-muted-foreground", className)}>
        <p>Add ingredients to see derived nutrition.</p>
      </div>
    );
  }

  if (!total || !perServing || !breakdown) {
    return (
      <div className={cn("space-y-2 text-sm text-[var(--color-error)]", className)}>
        <p role="alert">
          Nutrition cannot be calculated — check that every line uses a known
          ingredient and a matching unit.
        </p>
      </div>
    );
  }

  const hasOptional = recipe.lines.some((line) => line.optional);
  const attributionItems = breakdown
    .filter((row) => !row.optional && row.shareOfKcal != null)
    .map((row) => ({
      name: ingredientName(row.line.ingredientId, ingredientsById),
      percent: Number(formatPct(row.shareOfKcal ?? 0)),
    }))
    .sort((a, b) => b.percent - a.percent);

  const optionalRows = breakdown.filter((row) => row.optional);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Nutrition</h3>
        {hasOptional ? (
          <p className="text-sm text-muted-foreground">
            Totals exclude optional ingredients.
          </p>
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Whole recipe
            </p>
            <NutritionSummary
              kcal={Math.round(total.kcal)}
              protein={total.proteinG}
              carbs={total.carbsG}
              fat={total.fatG}
              sodiumMg={total.sodiumMg}
              variant="block"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Per serving ({recipe.servings})
            </p>
            <NutritionSummary
              kcal={Math.round(perServing.kcal)}
              protein={perServing.proteinG}
              carbs={perServing.carbsG}
              fat={perServing.fatG}
              sodiumMg={perServing.sodiumMg}
              variant="block"
            />
          </div>
        </div>
        <MacroBar segments={macroSegments(perServing)} />
      </div>

      {attributionItems.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            Calorie breakdown
          </h3>
          <AttributionList items={attributionItems} />
        </div>
      ) : null}

      {optionalRows.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Optional (not in totals)
          </h4>
          <ul className="space-y-1 text-sm">
            {optionalRows.map((row) => (
              <li
                key={row.line.id}
                className="flex items-center justify-between gap-4"
              >
                <span>
                  {ingredientName(row.line.ingredientId, ingredientsById)}
                </span>
                <span className="num text-muted-foreground">
                  {Math.round(row.nutrition.kcal)} kcal
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {previewServings !== recipe.servings ? (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            Scaled to {previewServings} servings
          </h3>
          <ScaledLinesList
            lines={scaled}
            ingredientsById={ingredientsById}
          />
        </div>
      ) : null}
    </div>
  );
}

function ScaledLinesList({
  lines,
  ingredientsById,
}: {
  lines: Array<{
    id: string;
    ingredientId: string;
    quantity: RecipeLine["quantity"];
    displayUnit: RecipeLine["displayUnit"];
    optional: boolean;
  }>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
}) {
  return (
    <ul className="divide-y divide-border border-t border-border">
      {lines.map((line) => (
        <li
          key={line.id}
          className="flex items-center justify-between gap-4 py-2 text-sm"
        >
          <span>
            {ingredientName(line.ingredientId, ingredientsById)}
            {line.optional ? (
              <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                Optional
              </span>
            ) : null}
          </span>
          <Quantity
            amount={formatQuantity(line.quantity, {
              displayUnit: line.displayUnit,
            })}
          />
        </li>
      ))}
    </ul>
  );
}

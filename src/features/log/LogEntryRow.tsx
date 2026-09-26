import { Pencil, Trash2 } from "lucide-react";
import {
  entryNutrition,
  type Ingredient,
  type LoggedMeal,
  type Recipe,
  type Batch,
} from "@/domain";
import {
  NutritionSummary,
  PlanSlotTile,
} from "@/features/components/domain-stubs";
import { Button } from "@/ui/button";
import { loggedMealLabel } from "./labels";

export type LogEntryRowProps = {
  meal: LoggedMeal;
  recipesById: ReadonlyMap<string, Recipe>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  batchesById: ReadonlyMap<string, Batch>;
  batchNameById: ReadonlyMap<string, string>;
  onEdit: () => void;
  onDelete: () => void;
};

export function LogEntryRow({
  meal,
  recipesById,
  ingredientsById,
  batchesById,
  batchNameById,
  onEdit,
  onDelete,
}: LogEntryRowProps) {
  const label = loggedMealLabel(
    meal,
    recipesById,
    ingredientsById,
    batchNameById,
  );
  const nutrition = entryNutrition(meal.entry, {
    recipesById,
    batchesById,
    ingredientsById,
  });
  const tileVariant =
    label.variant === "custom" ? "ingredient" : label.variant;

  return (
    <PlanSlotTile
      variant={tileVariant}
      title={label.title}
      subtitle={label.subtitle}
    >
      <div className="mt-2 space-y-2">
        {nutrition.ok ? (
          <NutritionSummary
            kcal={Math.round(nutrition.nutrition.kcal)}
            protein={Number(nutrition.nutrition.proteinG.toFixed(1))}
            carbs={Number(nutrition.nutrition.carbsG.toFixed(1))}
            fat={Number(nutrition.nutrition.fatG.toFixed(1))}
            sodiumMg={nutrition.nutrition.sodiumMg}
            variant="inline"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Nutrition unavailable</p>
        )}
        {meal.plannedMealId ? (
          <p className="text-xs text-muted-foreground">From plan</p>
        ) : null}
        {meal.note ? (
          <p className="truncate text-sm text-muted-foreground">{meal.note}</p>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Edit ${label.title}`}
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Delete ${label.title}`}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </PlanSlotTile>
  );
}

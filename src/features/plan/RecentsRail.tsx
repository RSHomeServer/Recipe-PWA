import type {
  Ingredient,
  PlanMealEntry,
  RecentEntry,
  Recipe,
} from "@/domain";
import { planEntryLabel } from "@/features/plan/labels";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";

export function RecentsRail({
  recents,
  recipesById,
  ingredientsById,
  batchNameById,
  disabled,
  onSelect,
  labelId = "recents-rail-label",
  heading = "Recent",
}: {
  recents: readonly RecentEntry[];
  recipesById: ReadonlyMap<string, Recipe>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  batchNameById: ReadonlyMap<string, string>;
  disabled?: boolean;
  onSelect: (entry: PlanMealEntry) => void;
  labelId?: string;
  heading?: string;
}) {
  if (recents.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label id={labelId}>{heading}</Label>
      <div
        className="flex flex-wrap gap-2"
        role="list"
        aria-labelledby={labelId}
      >
        {recents.map((recent) => {
          const label = planEntryLabel(
            recent.entry,
            recipesById,
            ingredientsById,
            batchNameById,
          );
          return (
            <Button
              key={recent.identityKey}
              type="button"
              role="listitem"
              variant="outline"
              size="sm"
              className="max-w-full"
              disabled={disabled}
              onClick={() => onSelect(recent.entry)}
            >
              <span className="truncate">{label.title}</span>
              <span className="ml-1 truncate text-muted-foreground">
                · {label.subtitle}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

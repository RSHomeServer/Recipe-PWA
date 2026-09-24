import {
  formatQuantity,
  type Ingredient,
  type PlanRequirementLine,
} from "@/domain";

export type RequirementsPreviewProps = {
  lines: PlanRequirementLine[];
  ingredientsById: ReadonlyMap<string, Ingredient>;
};

export function RequirementsPreview({
  lines,
  ingredientsById,
}: RequirementsPreviewProps) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No shopping requirements for this week. Batch portions do not add
        ingredients — only recipes to cook and bare ingredients do.
      </p>
    );
  }

  return (
    <ul className="app-list-measure space-y-2">
      {lines.map((line) => {
        const name =
          ingredientsById.get(line.ingredientId)?.name ?? "Unknown ingredient";
        return (
          <li key={line.ingredientId} className="app-list-row text-base">
            <span className="min-w-0 flex-1">{name}</span>
            <span className="app-list-row-metrics num font-mono text-sm text-muted-foreground">
              {formatQuantity(line.quantity)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

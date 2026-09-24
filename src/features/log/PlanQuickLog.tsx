import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PortionStepper } from "@/features/components/domain-stubs";
import type { BatchListRow } from "@/features/cook/hooks";
import {
  type Ingredient,
  type MealEntry,
  type PlannedMeal,
  type Recipe,
} from "@/domain";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { plannedMealQuickLabel } from "./labels";

export function PlanQuickLogRow({
  planned,
  recipesById,
  ingredientsById,
  batchNameById,
  onLog,
  onAdjust,
}: {
  planned: PlannedMeal;
  recipesById: ReadonlyMap<string, Recipe>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  batchNameById: ReadonlyMap<string, string>;
  onLog: () => void;
  onAdjust: () => void;
}) {
  const label = plannedMealQuickLabel(
    planned,
    recipesById,
    ingredientsById,
    batchNameById,
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{label.title}</p>
        <p className="truncate text-sm text-muted-foreground">{label.subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onLog}>
          Log
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onAdjust}>
          Adjust…
        </Button>
      </div>
    </div>
  );
}

export function GroupQuickLogRow({
  name,
  mealCount,
  onLogAll,
}: {
  name: string;
  mealCount: number;
  onLogAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {mealCount} item{mealCount === 1 ? "" : "s"} · grouped meal
        </p>
      </div>
      <Button type="button" size="sm" onClick={onLogAll}>
        Log all
      </Button>
    </div>
  );
}

export function FromPlanAdjust({
  planned,
  batchRows,
  onConfirm,
  onCancel,
}: {
  planned: PlannedMeal;
  batchRows: BatchListRow[] | undefined;
  onConfirm: (entry: MealEntry) => void;
  onCancel: () => void;
}) {
  const entry = planned.entry;
  const [servings, setServings] = useState(
    entry.kind === "recipeServings" ? entry.servings : 1,
  );
  const [portions, setPortions] = useState(
    entry.kind === "batchPortions" ? entry.portions : 1,
  );
  const [amount, setAmount] = useState(
    entry.kind === "ingredient" ? String(entry.quantity.value) : "0",
  );

  const remaining = useMemo(() => {
    if (entry.kind !== "batchPortions" || !batchRows) return null;
    const row = batchRows.find((r) => r.batch.id === entry.batchId);
    return row?.remaining ?? null;
  }, [entry, batchRows]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-[var(--color-surface-raised)] p-4">
      <p className="text-sm text-muted-foreground">
        Plan stays as-is. Change only what you actually ate.
      </p>
      {entry.kind === "recipeServings" ? (
        <div className="space-y-2">
          <Label>Servings eaten</Label>
          <PortionStepper value={servings} onChange={setServings} min={0.5} />
        </div>
      ) : null}
      {entry.kind === "batchPortions" ? (
        <div className="space-y-2">
          <Label>Portions eaten</Label>
          <PortionStepper value={portions} onChange={setPortions} min={0.5} />
          {remaining != null ? (
            <p className="text-sm text-muted-foreground">
              {remaining} remaining on batch
            </p>
          ) : null}
        </div>
      ) : null}
      {entry.kind === "ingredient" ? (
        <div className="space-y-2">
          <Label htmlFor="from-plan-amount">
            Amount ({entry.quantity.unit})
          </Label>
          <input
            id="from-plan-amount"
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-base"
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            if (entry.kind === "recipeServings") {
              onConfirm({ ...entry, servings });
            } else if (entry.kind === "batchPortions") {
              onConfirm({ ...entry, portions });
            } else if (entry.kind === "ingredient") {
              const value = Number(amount);
              if (!Number.isFinite(value) || value < 0) {
                toast.error("Enter a non-negative amount");
                return;
              }
              onConfirm({
                ...entry,
                quantity: { ...entry.quantity, value },
              });
            }
          }}
        >
          Log adjusted
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

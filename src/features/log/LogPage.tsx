import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRecipeData, useRepos } from "@/data";
import {
  DateRangeControl,
  MealSlotSection,
  PortionStepper,
} from "@/features/components/domain-stubs";
import { useBatchListRows, useLoggedMeals } from "@/features/cook/hooks";
import {
  useIngredientsForPlan,
  useMealSlots,
  usePlannedMeals,
  useRecipesForPlan,
} from "@/features/plan/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import {
  entryNutrition,
  formatDayHeading,
  formatKcal,
  sum,
  todayIso,
  toIsoDate,
  type Batch,
  type Ingredient,
  type LoggedMeal,
  type MealEntry,
  type PlannedMeal,
  type Recipe,
} from "@/domain";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import { AddLoggedMealForm } from "./AddLoggedMealForm";
import { createLogFromPlan, deleteLoggedMeal } from "./commands";
import { logsForSlot, useLoggedMealsForDate } from "./hooks";
import { LogEntryRow } from "./LogEntryRow";
import { plannedMealQuickLabel } from "./labels";

const logStateConfig = {
  empty: {
    title: "Nothing logged today.",
    actionLabel: "Log a meal",
  },
  loading: { rows: 4 },
  error: {
    title: "Could not load log",
    description: "Meal logs are stored on this device.",
  },
} as const;

type Composer =
  | { mode: "new"; date: string; slotId: string }
  | { mode: "edit"; meal: LoggedMeal }
  | { mode: "fromPlan"; planned: PlannedMeal }
  | null;

function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function PlanQuickLogRow({
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
  onLog: (entry?: MealEntry) => void;
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
        <Button type="button" size="sm" onClick={() => onLog()}>
          Log
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onAdjust}>
          Adjust…
        </Button>
      </div>
    </div>
  );
}

function FromPlanAdjust({
  planned,
  batchRows,
  onConfirm,
  onCancel,
}: {
  planned: PlannedMeal;
  batchRows: ReturnType<typeof useBatchListRows>;
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
            } else {
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

export default function LogPage() {
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const [date, setDate] = useState(() => todayIso());
  const [composer, setComposer] = useState<Composer>(null);

  const slots = useMealSlots();
  const logs = useLoggedMealsForDate(date);
  const allLogs = useLoggedMeals();
  const planned = usePlannedMeals();
  const recipes = useRecipesForPlan();
  const ingredients = useIngredientsForPlan();
  const batchRows = useBatchListRows();

  const recipesById = useMemo(() => {
    const map = new Map<string, Recipe>();
    for (const recipe of recipes ?? []) map.set(recipe.id, recipe);
    return map;
  }, [recipes]);

  const ingredientsById = useMemo(() => {
    const map = new Map<string, Ingredient>();
    for (const ingredient of ingredients ?? []) {
      map.set(ingredient.id, ingredient);
    }
    return map;
  }, [ingredients]);

  const batchesById = useMemo(() => {
    const map = new Map<string, Batch>();
    for (const row of batchRows ?? []) map.set(row.batch.id, row.batch);
    return map;
  }, [batchRows]);

  const batchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of batchRows ?? []) {
      map.set(
        row.batch.id,
        row.batch.label ?? row.batch.snapshot.recipeName,
      );
    }
    return map;
  }, [batchRows]);

  const plannedForDay = useMemo(() => {
    if (!planned) return undefined;
    return planned
      .filter((m) => m.date === date)
      .sort(
        (a, b) =>
          a.slotId.localeCompare(b.slotId) ||
          a.position - b.position ||
          a.id.localeCompare(b.id),
      );
  }, [planned, date]);

  const dayKcal = useMemo(() => {
    if (!logs) return null;
    const parts = logs.map((meal) => {
      const result = entryNutrition(meal.entry, {
        recipesById,
        batchesById,
        ingredientsById,
      });
      return result.ok ? result.nutrition : null;
    });
    const known = parts.filter((n): n is NonNullable<typeof n> => n != null);
    if (known.length === 0) return logs.length === 0 ? 0 : null;
    return Math.round(sum(known).kcal);
  }, [logs, recipesById, batchesById, ingredientsById]);

  const loading =
    !ready ||
    slots === undefined ||
    logs === undefined ||
    planned === undefined ||
    recipes === undefined ||
    ingredients === undefined ||
    batchRows === undefined ||
    allLogs === undefined;

  const dayEmpty = !loading && (logs?.length ?? 0) === 0;
  const hasPlan = (plannedForDay?.length ?? 0) > 0;

  const onDelete = async (meal: LoggedMeal) => {
    if (!repos) return;
    try {
      await deleteLoggedMeal(repos, meal);
      toast.success("Log deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete log",
      );
    }
  };

  const onLogFromPlan = async (
    plannedMeal: PlannedMeal,
    entry?: MealEntry,
  ) => {
    if (!repos) return;
    try {
      await createLogFromPlan(
        repos,
        plannedMeal,
        entry ? { entry } : undefined,
      );
      toast.success("Logged from plan");
      setComposer(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not log from plan",
      );
    }
  };

  if (dataError) {
    return (
      <div className="app-page content">
        <PageHeader title="Log" description="Diary by day — fast meal logging." />
        <RouteStatePanel state="error" config={logStateConfig} />
      </div>
    );
  }

  return (
    <div className="app-page content">
      <PageHeader
        title="Log"
        description="What you actually ate — day and slot. Plan stays intent."
        actions={
          <Button
            type="button"
            onClick={() => {
              const slotId = slots?.[0]?.id;
              if (!slotId) {
                toast.error("Add a meal slot in Settings first");
                return;
              }
              setComposer({ mode: "new", date, slotId });
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Log a meal
          </Button>
        }
      />

      <div className="mb-6">
        <DateRangeControl
          label={formatDayHeading(date)}
          onPrevious={() => setDate((d) => shiftDay(d, -1))}
          onNext={() => setDate((d) => shiftDay(d, 1))}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDate(todayIso())}
          >
            Today
          </Button>
        </DateRangeControl>
        {!loading && dayKcal != null ? (
          <p
            className="mt-3 num text-base text-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            Day total{" "}
            <strong className="font-semibold">{formatKcal(dayKcal)}</strong>{" "}
            <span className="text-muted-foreground">kcal</span>
          </p>
        ) : null}
      </div>

      {loading ? (
        <RouteStatePanel state="loading" config={logStateConfig} />
      ) : (
        <div className="space-y-8">
          {hasPlan ? (
            <section className="space-y-3" aria-labelledby="from-plan-heading">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2
                  id="from-plan-heading"
                  className="font-display text-lg font-semibold"
                >
                  From plan
                </h2>
                <Link
                  to="/plan"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Open plan
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                One tap copies the planned entry into the log. The plan is not
                changed.
              </p>
              <div className="space-y-2">
                {plannedForDay!.map((meal) => (
                  <PlanQuickLogRow
                    key={meal.id}
                    planned={meal}
                    recipesById={recipesById}
                    ingredientsById={ingredientsById}
                    batchNameById={batchNameById}
                    onLog={() => void onLogFromPlan(meal)}
                    onAdjust={() =>
                      setComposer({ mode: "fromPlan", planned: meal })
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {composer?.mode === "fromPlan" ? (
            <FromPlanAdjust
              planned={composer.planned}
              batchRows={batchRows}
              onConfirm={(entry) =>
                void onLogFromPlan(composer.planned, entry)
              }
              onCancel={() => setComposer(null)}
            />
          ) : null}

          {composer?.mode === "new" || composer?.mode === "edit" ? (
            <AddLoggedMealForm
              key={
                composer.mode === "edit"
                  ? composer.meal.id
                  : `${composer.date}-${composer.slotId}`
              }
              date={composer.mode === "edit" ? composer.meal.date : composer.date}
              slotId={
                composer.mode === "edit" ? composer.meal.slotId : composer.slotId
              }
              slots={slots!}
              recipes={recipes!}
              ingredients={ingredients!}
              batchRows={batchRows!}
              allLogs={allLogs!}
              editing={composer.mode === "edit" ? composer.meal : null}
              onDone={() => setComposer(null)}
              onCancel={() => setComposer(null)}
            />
          ) : null}

          {dayEmpty ? (
            <RouteStatePanel
              state="empty"
              config={{
                ...logStateConfig,
                empty: {
                  title: "Nothing logged today.",
                  actionLabel: hasPlan ? "Log planned meal" : "Log a meal",
                },
              }}
              onAction={() => {
                if (hasPlan && plannedForDay?.[0]) {
                  void onLogFromPlan(plannedForDay[0]);
                  return;
                }
                const slotId = slots![0]?.id;
                if (!slotId) {
                  toast.error("Add a meal slot in Settings first");
                  return;
                }
                setComposer({ mode: "new", date, slotId });
              }}
            />
          ) : (
            <div className="space-y-6">
              {slots!.map((slot) => {
                const slotLogs = logsForSlot(logs!, slot.id);
                return (
                  <MealSlotSection key={slot.id} slotLabel={slot.name}>
                    {slotLogs.map((meal) => (
                      <LogEntryRow
                        key={meal.id}
                        meal={meal}
                        recipesById={recipesById}
                        ingredientsById={ingredientsById}
                        batchesById={batchesById}
                        batchNameById={batchNameById}
                        onEdit={() =>
                          setComposer({ mode: "edit", meal })
                        }
                        onDelete={() => void onDelete(meal)}
                      />
                    ))}
                    {slotLogs.length === 0 ? (
                      <p className="px-1 text-sm text-muted-foreground">
                        Nothing logged
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setComposer({
                          mode: "new",
                          date,
                          slotId: slot.id,
                        })
                      }
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Log
                    </Button>
                  </MealSlotSection>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

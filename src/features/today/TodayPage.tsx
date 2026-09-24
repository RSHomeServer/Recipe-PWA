import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRecipeData, useRepos } from "@/data";
import {
  MealSlotSection,
  TargetReadout,
} from "@/features/components/domain-stubs";
import { useBatchListRows, useLoggedMeals } from "@/features/cook/hooks";
import { useTodayConsumedKcal } from "@/features/insights/hooks";
import {
  FromPlanAdjust,
  GroupQuickLogRow,
  PlanQuickLogRow,
} from "@/features/log/PlanQuickLog";
import { createLogFromPlan } from "@/features/log/commands";
import { ApplyMealDialog } from "@/features/meals/ApplyMealDialog";
import { logAllInGroup } from "@/features/meals/commands";
import { useMealTemplates } from "@/features/meals/hooks";
import { appendPlannedMeal } from "@/features/plan/appendPlannedMeal";
import {
  useIngredientsForPlan,
  useMealSlots,
  usePlannedMeals,
  useRecipesForPlan,
} from "@/features/plan/hooks";
import { RecentsRail } from "@/features/plan/RecentsRail";
import { useSettings } from "@/features/shopping/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import {
  deriveRecents,
  eachDateInRange,
  formatDayHeading,
  partitionSlotMeals,
  todayIso,
  weekContaining,
  type Ingredient,
  type MealEntry,
  type MealTemplate,
  type PlanMealEntry,
  type PlannedMeal,
  type Recipe,
} from "@/domain";
import { Button } from "@/ui/button";
import { Label } from "@/ui/label";
import {
  rememberPickerRecent,
} from "@/ui/picker-recents";
import { SegmentedGroup } from "@/ui/segmented-group";

const todayStateConfig = {
  empty: {
    title: "Nothing planned for today.",
    description:
      "Apply a saved meal, tap a recent, or open the plan to build the day.",
    actionLabel: "Open plan",
  },
  loading: { rows: 4 },
  error: {
    title: "Could not load today",
    description: "Your plan and log are stored on this device.",
  },
} as const;

export default function TodayPage() {
  const today = todayIso();
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const settings = useSettings();
  const consumed = useTodayConsumedKcal(today);
  const slots = useMealSlots();
  const planned = usePlannedMeals();
  const logged = useLoggedMeals();
  const recipes = useRecipesForPlan();
  const ingredients = useIngredientsForPlan();
  const batchRows = useBatchListRows();
  const templates = useMealTemplates();

  const weekDays = useMemo(
    () => eachDateInRange(weekContaining(today, 1)),
    [today],
  );

  const defaultSlotId = useMemo(() => {
    if (!slots?.length) return "";
    return slots.find((s) => s.isDefault)?.id ?? slots[0]!.id;
  }, [slots]);

  const [recentSlotId, setRecentSlotId] = useState("");
  const effectiveRecentSlotId = recentSlotId || defaultSlotId;

  const [adjusting, setAdjusting] = useState<PlannedMeal | null>(null);
  const [applyTemplate, setApplyTemplate] = useState<MealTemplate | null>(null);
  const [busy, setBusy] = useState(false);

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

  const plannedForToday = useMemo(() => {
    if (!planned) return undefined;
    return planned
      .filter((m) => m.date === today)
      .sort(
        (a, b) =>
          a.slotId.localeCompare(b.slotId) ||
          a.position - b.position ||
          a.id.localeCompare(b.id),
      );
  }, [planned, today]);

  const recents = useMemo(() => {
    if (!planned || !logged) return [];
    return deriveRecents(planned, logged);
  }, [planned, logged]);

  const activeTemplates = useMemo(() => {
    if (!templates) return undefined;
    return templates.filter((t) => t.archivedAt == null);
  }, [templates]);

  const loading =
    !ready ||
    slots === undefined ||
    planned === undefined ||
    logged === undefined ||
    recipes === undefined ||
    ingredients === undefined ||
    batchRows === undefined ||
    templates === undefined;

  const hasPlan = (plannedForToday?.length ?? 0) > 0;

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
      setAdjusting(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not log from plan",
      );
    }
  };

  const onLogAll = async (groupId: string) => {
    if (!repos || !planned) return;
    try {
      await logAllInGroup(repos, planned, groupId);
      toast.success("Logged meal");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not log meal",
      );
    }
  };

  const onRecentTap = async (entry: PlanMealEntry) => {
    if (!repos || busy) return;
    if (!effectiveRecentSlotId) {
      toast.error("Add a meal slot in Settings first");
      return;
    }
    if (entry.kind === "batchPortions") {
      const stillAvailable = (batchRows ?? []).some(
        (row) => row.available && row.batch.id === entry.batchId,
      );
      if (!stillAvailable) {
        toast.error("That batch no longer has portions left");
        return;
      }
    }
    setBusy(true);
    try {
      await appendPlannedMeal(repos, {
        date: today,
        slotId: effectiveRecentSlotId,
        entry,
      });
      if (entry.kind === "recipeServings") {
        rememberPickerRecent("recipes", entry.recipeId);
      } else if (entry.kind === "batchPortions") {
        rememberPickerRecent("batches", entry.batchId);
      } else {
        rememberPickerRecent("ingredients", entry.ingredientId);
      }
      toast.success("Added to today's plan");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add to plan",
      );
    } finally {
      setBusy(false);
    }
  };

  if (dataError) {
    return (
      <div className="app-page content">
        <PageHeader
          title="Today"
          description="What to eat, quick-log, and plan for today."
        />
        <RouteStatePanel state="error" config={todayStateConfig} />
      </div>
    );
  }

  return (
    <div className="app-page content space-y-8">
      <PageHeader
        title="Today"
        description={formatDayHeading(today)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/plan">Plan</Link>
            </Button>
            <Button asChild>
              <Link to="/log">Open log</Link>
            </Button>
          </div>
        }
      />

      {loading ? (
        <RouteStatePanel state="loading" config={todayStateConfig} />
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="today-plan-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  id="today-plan-heading"
                  className="font-display text-lg font-semibold"
                >
                  Today&apos;s plan
                </h2>
                <p className="text-sm text-muted-foreground">
                  One tap copies a planned entry into the log. The plan stays as
                  intent.
                </p>
              </div>
              <Link
                to="/plan"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Edit on Plan
              </Link>
            </div>

            {!hasPlan ? (
              <RouteStatePanel
                state="empty"
                config={todayStateConfig}
                onAction={() => void navigate("/plan")}
              />
            ) : (
              <div className="space-y-6">
                {slots!.map((slot) => {
                  const slotMeals = plannedForToday!.filter(
                    (m) => m.slotId === slot.id,
                  );
                  if (slotMeals.length === 0) return null;
                  const items = partitionSlotMeals(slotMeals);
                  return (
                    <MealSlotSection key={slot.id} slotLabel={slot.name}>
                      <div className="space-y-2">
                        {items.map((item) => {
                          if (item.kind === "group") {
                            return (
                              <div key={item.groupId} className="space-y-2">
                                <GroupQuickLogRow
                                  name={item.name}
                                  mealCount={item.meals.length}
                                  onLogAll={() => void onLogAll(item.groupId)}
                                />
                                {item.meals.map((meal) => (
                                  <PlanQuickLogRow
                                    key={meal.id}
                                    planned={meal}
                                    recipesById={recipesById}
                                    ingredientsById={ingredientsById}
                                    batchNameById={batchNameById}
                                    onLog={() => void onLogFromPlan(meal)}
                                    onAdjust={() => setAdjusting(meal)}
                                  />
                                ))}
                              </div>
                            );
                          }
                          return (
                            <PlanQuickLogRow
                              key={item.meal.id}
                              planned={item.meal}
                              recipesById={recipesById}
                              ingredientsById={ingredientsById}
                              batchNameById={batchNameById}
                              onLog={() => void onLogFromPlan(item.meal)}
                              onAdjust={() => setAdjusting(item.meal)}
                            />
                          );
                        })}
                      </div>
                    </MealSlotSection>
                  );
                })}
              </div>
            )}

            {adjusting ? (
              <FromPlanAdjust
                planned={adjusting}
                batchRows={batchRows}
                onConfirm={(entry) => void onLogFromPlan(adjusting, entry)}
                onCancel={() => setAdjusting(null)}
              />
            ) : null}
          </section>

          {recents.length > 0 ? (
            <section
              className="space-y-3"
              aria-labelledby="today-recents-heading"
            >
              <div>
                <h2
                  id="today-recents-heading"
                  className="font-display text-lg font-semibold"
                >
                  Recents
                </h2>
                <p className="text-sm text-muted-foreground">
                  Tap to add to today&apos;s plan in the slot below.
                </p>
              </div>
              {slots!.length > 1 ? (
                <div className="space-y-2">
                  <Label id="today-recent-slot-label">Slot</Label>
                  <SegmentedGroup
                    id="today-recent-slot"
                    aria-labelledby="today-recent-slot-label"
                    value={effectiveRecentSlotId}
                    onValueChange={setRecentSlotId}
                    options={slots!.map((slot) => ({
                      value: slot.id,
                      label: slot.name,
                    }))}
                  />
                </div>
              ) : null}
              <RecentsRail
                recents={recents}
                recipesById={recipesById}
                ingredientsById={ingredientsById}
                batchNameById={batchNameById}
                disabled={busy}
                onSelect={(entry) => void onRecentTap(entry)}
                labelId="today-recents-rail-label"
                heading="Recent"
              />
            </section>
          ) : null}

          <section
            className="space-y-3"
            aria-labelledby="today-apply-heading"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  id="today-apply-heading"
                  className="font-display text-lg font-semibold"
                >
                  Apply a meal
                </h2>
                <p className="text-sm text-muted-foreground">
                  Saved combinations — tick today or several days at once.
                </p>
              </div>
              <Link
                to="/meals"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Manage meals
              </Link>
            </div>
            {(activeTemplates?.length ?? 0) === 0 ? (
              <p className="text-base text-muted-foreground">
                No saved meals yet. Plan a few items on one day, then use{" "}
                <em>Save these as a meal</em>, or{" "}
                <Link
                  to="/meals/new"
                  className="underline-offset-4 hover:underline"
                >
                  create a meal
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {activeTemplates!.map((template) => (
                  <li
                    key={template.id}
                    className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {template.components.length} component
                        {template.components.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setApplyTemplate(template)}
                    >
                      Apply…
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {settings != null && consumed != null ? (
            <section
              className="space-y-2"
              aria-labelledby="today-target-heading"
            >
              <h2
                id="today-target-heading"
                className="font-display text-lg font-semibold"
              >
                Energy
              </h2>
              <TargetReadout
                target={settings.dailyCalorieTarget}
                consumed={consumed}
              />
            </section>
          ) : null}
        </>
      )}

      {applyTemplate && slots ? (
        <ApplyMealDialog
          open={applyTemplate != null}
          onOpenChange={(open) => {
            if (!open) setApplyTemplate(null);
          }}
          template={applyTemplate}
          days={weekDays}
          slots={slots}
          initialSlotId={
            applyTemplate.defaultSlotId ?? defaultSlotId ?? slots[0]?.id
          }
          initialDates={[today]}
        />
      ) : null}
    </div>
  );
}

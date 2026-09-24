import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRecipeData, useRepos } from "@/data";
import {
  eachDateInRange,
  formatDayCompact,
  formatDayHeading,
  formatWeekRangeLabel,
  shiftWeek,
  todayIso,
  weekContaining,
  type Ingredient,
  type MealSlot,
  type PlannedMeal,
  type Recipe,
} from "@/domain";
import {
  MealSlotSection,
  PlanSlotTile,
} from "@/features/components/domain-stubs";
import { useBatchListRows } from "@/features/cook/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { Button } from "@/ui/button";
import { CommandPicker } from "@/ui/command-picker";
import { cn } from "@/ui/lib/utils";
import { AddPlannedMealForm } from "./AddPlannedMealForm";
import {
  mealsForSlot,
  mealsInRange,
  useIngredientsForPlan,
  useMealSlots,
  usePlanRequirements,
  usePlannedMeals,
  useRecipesForPlan,
} from "./hooks";
import {
  moveTargetOptions,
  plannedMealLabel,
} from "./labels";
import { RequirementsPreview } from "./RequirementsPreview";
import { movePlannedMeal } from "./reorder";
import { useIsMdUp } from "./use-media";

const listStateConfig = {
  empty: {
    title: "Nothing planned for this week.",
    actionLabel: "Plan a meal",
  },
  loading: { rows: 4 },
  error: {
    title: "Could not load meal plan",
    description: "Your plan is stored locally on this device.",
  },
} as const;

type DropId = string; // `${date}|${slotId}`

function parseDropId(id: string): { date: string; slotId: string } | null {
  const sep = id.indexOf("|");
  if (sep < 0) return null;
  return { date: id.slice(0, sep), slotId: id.slice(sep + 1) };
}

function SortableMealCard({
  meal,
  label,
  moveOptions,
  currentTarget,
  onMoveTo,
  onDelete,
}: {
  meal: PlannedMeal;
  label: ReturnType<typeof plannedMealLabel>;
  moveOptions: { value: string; label: string }[];
  currentTarget: string;
  onMoveTo: (target: string) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: meal.id, data: { meal } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("min-w-0 max-w-full", isDragging && "opacity-40")}
    >
      <PlanSlotTile
        variant={label.variant}
        title={label.title}
        subtitle={label.subtitle}
      >
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Drag ${label.title}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={`Remove ${label.title}`}
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <label className="sr-only" id={`move-${meal.id}-label`}>
            Move {label.title} to
          </label>
          <CommandPicker
            id={`move-${meal.id}`}
            aria-labelledby={`move-${meal.id}-label`}
            title="Move to…"
            placeholder="Move to…"
            searchPlaceholder="Search day and slot…"
            value=""
            onValueChange={(next) => {
              if (next) onMoveTo(next);
            }}
            items={moveOptions
              .filter((opt) => opt.value !== currentTarget)
              .map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
          />
        </div>
        {meal.note ? (
          <p className="mt-2 truncate text-sm text-muted-foreground">{meal.note}</p>
        ) : null}
      </PlanSlotTile>
    </div>
  );
}

function SlotDropZone({
  dropId,
  slot,
  meals,
  recipesById,
  ingredientsById,
  batchNameById,
  moveOptions,
  onMoveTo,
  onDelete,
  onAdd,
}: {
  dropId: DropId;
  slot: MealSlot;
  meals: PlannedMeal[];
  recipesById: ReadonlyMap<string, Recipe>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  batchNameById: ReadonlyMap<string, string>;
  moveOptions: { value: string; label: string }[];
  onMoveTo: (mealId: string, target: string) => void;
  onDelete: (mealId: string) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const ids = meals.map((m) => m.id);

  return (
    <MealSlotSection slotLabel={slot.name}>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-12 min-w-0 space-y-2 rounded-md p-0.5 transition-colors",
          isOver && "bg-[var(--color-accent-muted)]/40",
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {meals.map((meal) => {
            const label = plannedMealLabel(
              meal,
              recipesById,
              ingredientsById,
              batchNameById,
            );
            return (
              <SortableMealCard
                key={meal.id}
                meal={meal}
                label={label}
                moveOptions={moveOptions}
                currentTarget={dropId}
                onMoveTo={(target) => onMoveTo(meal.id, target)}
                onDelete={() => onDelete(meal.id)}
              />
            );
          })}
        </SortableContext>
        {meals.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">Nothing planned</p>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
    </MealSlotSection>
  );
}

export default function PlanPage() {
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const slots = useMealSlots();
  const meals = usePlannedMeals();
  const recipes = useRecipesForPlan();
  const ingredients = useIngredientsForPlan();
  const batchRows = useBatchListRows();

  const [week, setWeek] = useState(() => weekContaining(todayIso(), 1));
  const [selectedDay, setSelectedDay] = useState(() => todayIso());
  const [composer, setComposer] = useState<{
    date: string;
    slotId: string;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const isMdUp = useIsMdUp();

  const days = useMemo(() => eachDateInRange(week), [week]);
  const weekMeals = useMemo(
    () => (meals ? mealsInRange(meals, week) : undefined),
    [meals, week],
  );
  const requirementLines = usePlanRequirements(
    meals,
    week,
    recipes,
    ingredients,
  );

  const recipesById = useMemo(
    () => new Map((recipes ?? []).map((r) => [r.id, r])),
    [recipes],
  );
  const ingredientsById = useMemo(
    () => new Map((ingredients ?? []).map((i) => [i.id, i])),
    [ingredients],
  );
  const batchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of batchRows ?? []) {
      map.set(row.batch.id, row.batch.snapshot.recipeName);
    }
    return map;
  }, [batchRows]);

  const moveOptions = useMemo(
    () => moveTargetOptions(days, slots ?? [], formatDayCompact),
    [days, slots],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeMeal = useMemo(
    () => (meals && activeId ? meals.find((m) => m.id === activeId) : null),
    [meals, activeId],
  );

  const persistUpdates = async (updates: PlannedMeal[]) => {
    if (!repos || updates.length === 0) return;
    try {
      await Promise.all(updates.map((row) => repos.plannedMeals.put(row)));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update plan",
      );
    }
  };

  const handleMoveTo = async (mealId: string, target: string) => {
    if (!meals) return;
    const parsed = parseDropId(target);
    if (!parsed) return;
    const current = meals.find((m) => m.id === mealId);
    if (!current) return;
    if (current.date === parsed.date && current.slotId === parsed.slotId) {
      return;
    }
    const targetMeals = mealsForSlot(meals, parsed.date, parsed.slotId);
    const updates = movePlannedMeal(
      meals,
      mealId,
      parsed.date,
      parsed.slotId,
      targetMeals.length,
    );
    await persistUpdates(updates);
  };

  const handleDelete = async (mealId: string) => {
    if (!repos || !meals) return;
    const victim = meals.find((m) => m.id === mealId);
    if (!victim) return;
    try {
      await repos.plannedMeals.delete(mealId);
      const siblings = mealsForSlot(meals, victim.date, victim.slotId).filter(
        (m) => m.id !== mealId,
      );
      const densified = siblings.map((m, index) =>
        m.position === index ? m : { ...m, position: index },
      );
      await persistUpdates(
        densified.filter((_m, index) => siblings[index]!.position !== index),
      );
      toast.success("Removed from plan");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove meal",
      );
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    if (!meals) return;
    const { active, over } = event;
    if (!over) return;

    const mealId = String(active.id);
    const overId = String(over.id);

    let targetDate: string;
    let targetSlotId: string;
    let targetIndex: number;

    const overAsDrop = parseDropId(overId);
    if (overAsDrop && !meals.some((m) => m.id === overId)) {
      targetDate = overAsDrop.date;
      targetSlotId = overAsDrop.slotId;
      targetIndex = mealsForSlot(meals, targetDate, targetSlotId).filter(
        (m) => m.id !== mealId,
      ).length;
    } else {
      const overMeal = meals.find((m) => m.id === overId);
      if (!overMeal) return;
      targetDate = overMeal.date;
      targetSlotId = overMeal.slotId;
      const siblings = mealsForSlot(meals, targetDate, targetSlotId).filter(
        (m) => m.id !== mealId,
      );
      const overIndex = siblings.findIndex((m) => m.id === overId);
      targetIndex = overIndex < 0 ? siblings.length : overIndex;
    }

    const updates = movePlannedMeal(
      meals,
      mealId,
      targetDate,
      targetSlotId,
      targetIndex,
    );
    await persistUpdates(updates);
  };

  const openComposer = (date: string, slotId?: string) => {
    setComposer({
      date,
      slotId: slotId ?? slots?.[0]?.id ?? "",
    });
  };

  const shiftSelectedDay = (delta: number) => {
    const idx = days.indexOf(selectedDay);
    if (idx < 0) {
      setSelectedDay(days[0]!);
      return;
    }
    const next = days[idx + delta];
    if (next) setSelectedDay(next);
  };

  // Keep selected day inside the visible week when the week changes.
  const dayInWeek = days.includes(selectedDay) ? selectedDay : days[0]!;

  if (dataError) {
    return (
      <div className="app-page">
        <PageHeader title="Meal plan" description="Plan meals by day and slot." />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (
    !ready ||
    slots === undefined ||
    meals === undefined ||
    recipes === undefined ||
    ingredients === undefined ||
    batchRows === undefined ||
    weekMeals === undefined ||
    requirementLines === undefined
  ) {
    return (
      <div className="app-page">
        <PageHeader title="Meal plan" description="Plan meals by day and slot." />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  const activeLabel = activeMeal
    ? plannedMealLabel(
        activeMeal,
        recipesById,
        ingredientsById,
        batchNameById,
      )
    : null;

  return (
    <div className="app-page space-y-8">
      <PageHeader
        title="Meal plan"
        description="Plan what you will cook, eat from batches you already made, or have raw. Planning never touches the pantry."
        actions={
          <Button type="button" onClick={() => openComposer(dayInWeek)}>
            <Plus className="size-4" aria-hidden="true" />
            Plan a meal
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous week"
          onClick={() => setWeek((w) => shiftWeek(w, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-[12rem] text-center text-base font-medium">
          {formatWeekRangeLabel(week)}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next week"
          onClick={() => setWeek((w) => shiftWeek(w, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const now = todayIso();
            setWeek(weekContaining(now, 1));
            setSelectedDay(now);
          }}
        >
          This week
        </Button>
      </div>

      {composer ? (
        <AddPlannedMealForm
          date={composer.date}
          slotId={composer.slotId || slots[0]!.id}
          slots={slots}
          recipes={recipes}
          ingredients={ingredients}
          batchRows={batchRows}
          onDone={() => setComposer(null)}
          onCancel={() => setComposer(null)}
        />
      ) : null}

      {weekMeals.length === 0 && !composer ? (
        <RouteStatePanel
          state="empty"
          config={listStateConfig}
          onAction={() => openComposer(dayInWeek)}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={(event) => void onDragEnd(event)}
        >
          {!isMdUp ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous day"
                  onClick={() => shiftSelectedDay(-1)}
                  disabled={days.indexOf(dayInWeek) <= 0}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <p className="flex-1 text-center font-display text-lg font-semibold">
                  {formatDayHeading(dayInWeek)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next day"
                  onClick={() => shiftSelectedDay(1)}
                  disabled={days.indexOf(dayInWeek) >= days.length - 1}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {days.map((date) => (
                  <button
                    key={date}
                    type="button"
                    className={cn(
                      "shrink-0 rounded-md px-3 py-2 text-sm",
                      date === dayInWeek
                        ? "bg-accent text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                    onClick={() => setSelectedDay(date)}
                  >
                    {formatDayHeading(date).split(" ")[0]}
                  </button>
                ))}
              </div>
              <div className="space-y-6">
                {slots.map((slot) => {
                  const dropId = `${dayInWeek}|${slot.id}`;
                  return (
                    <SlotDropZone
                      key={dropId}
                      dropId={dropId}
                      slot={slot}
                      meals={mealsForSlot(weekMeals, dayInWeek, slot.id)}
                      recipesById={recipesById}
                      ingredientsById={ingredientsById}
                      batchNameById={batchNameById}
                      moveOptions={moveOptions}
                      onMoveTo={(mealId, target) =>
                        void handleMoveTo(mealId, target)
                      }
                      onDelete={(mealId) => void handleDelete(mealId)}
                      onAdd={() => openComposer(dayInWeek, slot.id)}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {days.map((date) => (
                <div key={date} className="min-w-0 space-y-3 overflow-hidden">
                  <h2 className="truncate font-display text-sm font-semibold">
                    {formatDayHeading(date)}
                  </h2>
                  {slots.map((slot) => {
                    const dropId = `${date}|${slot.id}`;
                    return (
                      <SlotDropZone
                        key={dropId}
                        dropId={dropId}
                        slot={slot}
                        meals={mealsForSlot(weekMeals, date, slot.id)}
                        recipesById={recipesById}
                        ingredientsById={ingredientsById}
                        batchNameById={batchNameById}
                        moveOptions={moveOptions}
                        onMoveTo={(mealId, target) =>
                          void handleMoveTo(mealId, target)
                        }
                        onDelete={(mealId) => void handleDelete(mealId)}
                        onAdd={() => openComposer(date, slot.id)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <DragOverlay>
            {activeLabel ? (
              <PlanSlotTile
                variant={activeLabel.variant}
                title={activeLabel.title}
                subtitle={activeLabel.subtitle}
                className="shadow-lg"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <section className="space-y-3 border-t border-border pt-8">
        <h2 className="font-display text-xl font-semibold">
          Ingredient requirements
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Derived for {formatWeekRangeLabel(week)}. Shopping (minus pantry) comes
          in the next step — this is the plan aggregate only.
        </p>
        <RequirementsPreview
          lines={requirementLines}
          ingredientsById={ingredientsById}
        />
      </section>
    </div>
  );
}

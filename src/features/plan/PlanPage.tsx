import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRecipeData, useRepos } from "@/data";
import {
  canSaveSlotAsMeal,
  eachDateInRange,
  formatDayCompact,
  formatDayHeading,
  formatWeekRangeLabel,
  mealTemplatePrefillFromSlot,
  partitionSlotMeals,
  shiftWeek,
  todayIso,
  weekContaining,
  type Ingredient,
  type MealSlot,
  type MealTemplate,
  type PlannedMeal,
  type Recipe,
} from "@/domain";
import {
  MealSlotSection,
  PlanSlotTile,
  type PlanSlotTileDensity,
} from "@/features/components/domain-stubs";
import { useBatchListRows } from "@/features/cook/hooks";
import {
  logAllInGroup,
  moveAllInGroup,
  removeAllInGroup,
  ungroupPlanGroup,
} from "@/features/meals/commands";
import { ApplyMealDialog } from "@/features/meals/ApplyMealDialog";
import { useMealTemplates } from "@/features/meals/hooks";
import {
  GroupedMealCard,
} from "@/features/plan/GroupedMealCard";
import {
  groupSortableId,
  parseGroupSortableId,
} from "@/features/plan/group-sortable";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
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
import { HowThisWorksPanel } from "@/features/shared/HowThisWorks";
import { InfoPopover } from "@/features/shared/InfoPopover";
import { LEXICON } from "@/features/shared/entry-kind-copy";

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
  density,
  moveOptions,
  currentTarget,
  onMoveTo,
  onDelete,
}: {
  meal: PlannedMeal;
  label: ReturnType<typeof plannedMealLabel>;
  density: PlanSlotTileDensity;
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

  const destinations = moveOptions.filter((opt) => opt.value !== currentTarget);

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
        density={density}
      >
        <div
          className={cn(
            "mt-2 flex items-center gap-1.5",
            density === "compact" && "mt-1.5",
          )}
        >
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Drag ${label.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Actions for ${label.title}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move to…</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto">
                  {destinations.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onSelect={() => onMoveTo(opt.value)}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--color-error)] focus:text-[var(--color-error)]"
                onSelect={onDelete}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {meal.note && density !== "compact" ? (
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
  density,
  moveOptions,
  onMoveTo,
  onDelete,
  onMoveAllTo,
  onRemoveAll,
  onLogAll,
  onUngroup,
  onAdd,
  onSaveAsMeal,
}: {
  dropId: DropId;
  slot: MealSlot;
  meals: PlannedMeal[];
  recipesById: ReadonlyMap<string, Recipe>;
  ingredientsById: ReadonlyMap<string, Ingredient>;
  batchNameById: ReadonlyMap<string, string>;
  density: PlanSlotTileDensity;
  moveOptions: { value: string; label: string }[];
  onMoveTo: (mealId: string, target: string) => void;
  onDelete: (mealId: string) => void;
  onMoveAllTo: (groupId: string, target: string) => void;
  onRemoveAll: (groupId: string) => void;
  onLogAll: (groupId: string) => void;
  onUngroup: (groupId: string) => void;
  onAdd: () => void;
  onSaveAsMeal: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const items = partitionSlotMeals(meals);
  const sortableIds = items.map((item) =>
    item.kind === "group" ? groupSortableId(item.groupId) : item.meal.id,
  );
  const showSaveAsMeal = canSaveSlotAsMeal(meals);

  return (
    <MealSlotSection slotLabel={slot.name}>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-12 min-w-0 space-y-2 rounded-md p-0.5 transition-colors",
          isOver && "bg-[var(--color-accent-muted)]/40",
        )}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {items.map((item) => {
            if (item.kind === "group") {
              return (
                <GroupedMealCard
                  key={item.groupId}
                  groupId={item.groupId}
                  name={item.name}
                  meals={item.meals}
                  density={density}
                  moveOptions={moveOptions}
                  currentTarget={dropId}
                  labelFor={(meal) =>
                    plannedMealLabel(
                      meal,
                      recipesById,
                      ingredientsById,
                      batchNameById,
                    )
                  }
                  onMoveAllTo={(target) => onMoveAllTo(item.groupId, target)}
                  onRemoveAll={() => onRemoveAll(item.groupId)}
                  onLogAll={() => onLogAll(item.groupId)}
                  onUngroup={() => onUngroup(item.groupId)}
                  onMoveMemberTo={onMoveTo}
                  onDeleteMember={onDelete}
                />
              );
            }
            const label = plannedMealLabel(
              item.meal,
              recipesById,
              ingredientsById,
              batchNameById,
            );
            return (
              <SortableMealCard
                key={item.meal.id}
                meal={item.meal}
                label={label}
                density={density}
                moveOptions={moveOptions}
                currentTarget={dropId}
                onMoveTo={(target) => onMoveTo(item.meal.id, target)}
                onDelete={() => onDelete(item.meal.id)}
              />
            );
          })}
        </SortableContext>
        {meals.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">Nothing planned</p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
          {showSaveAsMeal ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSaveAsMeal}
            >
              Save these as a meal
            </Button>
          ) : null}
        </div>
      </div>
    </MealSlotSection>
  );
}

export default function PlanPage() {
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const slots = useMealSlots();
  const meals = usePlannedMeals();
  const recipes = useRecipesForPlan();
  const ingredients = useIngredientsForPlan();
  const batchRows = useBatchListRows();
  const templates = useMealTemplates();

  const [week, setWeek] = useState(() => weekContaining(todayIso(), 1));
  const [selectedDay, setSelectedDay] = useState(() => todayIso());
  const [composer, setComposer] = useState<{
    date: string;
    slotId: string;
  } | null>(null);
  const [applyTemplate, setApplyTemplate] = useState<MealTemplate | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const isMdUp = useIsMdUp();
  const weekTrackRef = useRef<HTMLDivElement>(null);

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

  const activeMeal = useMemo(() => {
    if (!meals || !activeId) return null;
    if (parseGroupSortableId(activeId)) return null;
    return meals.find((m) => m.id === activeId) ?? null;
  }, [meals, activeId]);

  const activeGroupMeals = useMemo(() => {
    if (!meals || !activeId) return null;
    const groupId = parseGroupSortableId(activeId);
    if (!groupId) return null;
    return meals.filter((m) => m.group?.id === groupId);
  }, [meals, activeId]);

  useEffect(() => {
    if (!isMdUp) return;
    const today = todayIso();
    const targetDate = days.includes(today) ? today : days[0];
    if (!targetDate) return;
    const column = weekTrackRef.current?.querySelector(
      `[data-plan-day="${targetDate}"]`,
    );
    column?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant",
    });
  }, [isMdUp, week, days]);

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

  const handleMoveAllTo = async (groupId: string, target: string) => {
    if (!repos || !meals) return;
    const parsed = parseDropId(target);
    if (!parsed) return;
    try {
      await moveAllInGroup(
        repos,
        meals,
        groupId,
        parsed.date,
        parsed.slotId,
      );
      toast.success("Moved meal");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not move meal",
      );
    }
  };

  const handleRemoveAll = async (groupId: string) => {
    if (!repos || !meals) return;
    try {
      await removeAllInGroup(repos, meals, groupId);
      toast.success("Removed meal from plan");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove meal",
      );
    }
  };

  const handleLogAll = async (groupId: string) => {
    if (!repos || !meals) return;
    try {
      await logAllInGroup(repos, meals, groupId);
      toast.success("Logged all components");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not log meal",
      );
    }
  };

  const handleUngroup = async (groupId: string) => {
    if (!repos || !meals) return;
    try {
      await ungroupPlanGroup(repos, meals, groupId);
      toast.success("Ungrouped");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not ungroup",
      );
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    if (!meals || !repos) return;
    const { active, over } = event;
    if (!over) return;

    const activeRaw = String(active.id);
    const overId = String(over.id);
    const groupId = parseGroupSortableId(activeRaw);

    let targetDate: string;
    let targetSlotId: string;
    let targetIndex: number;

    const overAsDrop = parseDropId(overId);
    const overGroupId = parseGroupSortableId(overId);

    if (overAsDrop && !meals.some((m) => m.id === overId) && !overGroupId) {
      targetDate = overAsDrop.date;
      targetSlotId = overAsDrop.slotId;
      targetIndex = mealsForSlot(meals, targetDate, targetSlotId).filter(
        (m) => (groupId ? m.group?.id !== groupId : m.id !== activeRaw),
      ).length;
    } else if (overGroupId) {
      const overMembers = meals.filter((m) => m.group?.id === overGroupId);
      const first = overMembers[0];
      if (!first) return;
      targetDate = first.date;
      targetSlotId = first.slotId;
      targetIndex = Math.min(
        ...overMembers.map((m) => m.position),
      );
    } else {
      const overMeal = meals.find((m) => m.id === overId);
      if (!overMeal) return;
      targetDate = overMeal.date;
      targetSlotId = overMeal.slotId;
      const siblings = mealsForSlot(meals, targetDate, targetSlotId).filter(
        (m) => (groupId ? m.group?.id !== groupId : m.id !== activeRaw),
      );
      const overIndex = siblings.findIndex((m) => m.id === overId);
      targetIndex = overIndex < 0 ? siblings.length : overIndex;
    }

    if (groupId) {
      try {
        await moveAllInGroup(
          repos,
          meals,
          groupId,
          targetDate,
          targetSlotId,
          targetIndex,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not move meal",
        );
      }
      return;
    }

    const updates = movePlannedMeal(
      meals,
      activeRaw,
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

  const openSaveAsMeal = (date: string, slot: MealSlot) => {
    const slotMeals = mealsForSlot(weekMeals ?? [], date, slot.id);
    const prefill = mealTemplatePrefillFromSlot(slotMeals, slot.id);
    if (!prefill) {
      toast.error("Need at least two ungrouped recipes or ingredients");
      return;
    }
    void navigate("/meals/new", {
      state: {
        saveAsMeal: {
          components: prefill.components,
          defaultSlotId: prefill.defaultSlotId,
        },
      },
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
      <div className="app-page workspace">
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
    requirementLines === undefined ||
    templates === undefined
  ) {
    return (
      <div className="app-page workspace">
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
  const activeTemplates = templates.filter((t) => t.archivedAt == null);

  return (
    <div className="app-page workspace space-y-8">
      <PageHeader
        title="Meal plan"
        titleAccessory={
          <InfoPopover label="What is planned food?">
            <p className="font-medium text-foreground">Planned</p>
            <p className="mt-1 text-muted-foreground">{LEXICON.planned}</p>
            <p className="mt-3 font-medium text-foreground">Batch</p>
            <p className="mt-1 text-muted-foreground">{LEXICON.batch}</p>
          </InfoPopover>
        }
        description="Plan what you will cook, eat from batches, or take from the pack. Planning never touches the pantry."
        actions={
          <div className="flex flex-wrap gap-2">
            {activeTemplates.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline">
                    <UtensilsCrossed className="size-4" aria-hidden="true" />
                    Apply a meal
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[14rem]">
                  {activeTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onSelect={() => setApplyTemplate(template)}
                    >
                      {template.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/meals">Manage meals…</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button type="button" variant="outline" asChild>
                <Link to="/meals/new">
                  <UtensilsCrossed className="size-4" aria-hidden="true" />
                  Save a meal
                </Link>
              </Button>
            )}
            <Button type="button" onClick={() => openComposer(dayInWeek)}>
              <Plus className="size-4" aria-hidden="true" />
              Plan a meal
            </Button>
          </div>
        }
      />

      <HowThisWorksPanel />

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
                      density="comfortable"
                      moveOptions={moveOptions}
                      onMoveTo={(mealId, target) =>
                        void handleMoveTo(mealId, target)
                      }
                      onDelete={(mealId) => void handleDelete(mealId)}
                      onMoveAllTo={(groupId, target) =>
                        void handleMoveAllTo(groupId, target)
                      }
                      onRemoveAll={(groupId) => void handleRemoveAll(groupId)}
                      onLogAll={(groupId) => void handleLogAll(groupId)}
                      onUngroup={(groupId) => void handleUngroup(groupId)}
                      onAdd={() => openComposer(dayInWeek, slot.id)}
                      onSaveAsMeal={() => openSaveAsMeal(dayInWeek, slot)}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div ref={weekTrackRef} className="plan-week-track">
              {days.map((date) => (
                <div
                  key={date}
                  data-plan-day={date}
                  className="plan-week-day min-w-0 space-y-3 overflow-hidden"
                >
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
                        density="compact"
                        moveOptions={moveOptions}
                        onMoveTo={(mealId, target) =>
                          void handleMoveTo(mealId, target)
                        }
                        onDelete={(mealId) => void handleDelete(mealId)}
                        onMoveAllTo={(groupId, target) =>
                          void handleMoveAllTo(groupId, target)
                        }
                        onRemoveAll={(groupId) => void handleRemoveAll(groupId)}
                        onLogAll={(groupId) => void handleLogAll(groupId)}
                        onUngroup={(groupId) => void handleUngroup(groupId)}
                        onAdd={() => openComposer(date, slot.id)}
                        onSaveAsMeal={() => openSaveAsMeal(date, slot)}
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
                density={isMdUp ? "compact" : "comfortable"}
                className="shadow-lg"
              />
            ) : activeGroupMeals && activeGroupMeals.length > 0 ? (
              <PlanSlotTile
                variant="cook"
                title={activeGroupMeals[0]!.group?.name ?? "Meal"}
                subtitle={`${activeGroupMeals.length} items`}
                density={isMdUp ? "compact" : "comfortable"}
                className="shadow-lg"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <section className="space-y-4 border-t border-border pt-8">
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

      {applyTemplate ? (
        <ApplyMealDialog
          open
          onOpenChange={(open) => {
            if (!open) setApplyTemplate(null);
          }}
          template={applyTemplate}
          days={days}
          slots={slots}
          initialSlotId={
            applyTemplate.defaultSlotId ?? slots[0]?.id ?? undefined
          }
          initialDates={days}
        />
      ) : null}
    </div>
  );
}

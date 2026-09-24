import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import type { PlannedMeal } from "@/domain";
import {
  PlanSlotTile,
  type PlanSlotTileDensity,
} from "@/features/components/domain-stubs";
import { groupSortableId } from "@/features/plan/group-sortable";
import { plannedMealLabel } from "@/features/plan/labels";
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

export function GroupedMealCard({
  groupId,
  name,
  meals,
  density,
  moveOptions,
  currentTarget,
  labelFor,
  onMoveAllTo,
  onRemoveAll,
  onLogAll,
  onUngroup,
  onMoveMemberTo,
  onDeleteMember,
}: {
  groupId: string;
  name: string;
  meals: PlannedMeal[];
  density: PlanSlotTileDensity;
  moveOptions: { value: string; label: string }[];
  currentTarget: string;
  labelFor: (meal: PlannedMeal) => ReturnType<typeof plannedMealLabel>;
  onMoveAllTo: (target: string) => void;
  onRemoveAll: () => void;
  onLogAll: () => void;
  onUngroup: () => void;
  onMoveMemberTo: (mealId: string, target: string) => void;
  onDeleteMember: (mealId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sortableId = groupSortableId(groupId);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: { kind: "group", groupId, meals },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const destinations = moveOptions.filter((opt) => opt.value !== currentTarget);
  const subtitle = `${meals.length} items`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("min-w-0 max-w-full", isDragging && "opacity-40")}
    >
      <PlanSlotTile
        variant="cook"
        title={name}
        subtitle={subtitle}
        density={density}
      >
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-1.5",
            density === "compact" && "mt-1.5",
          )}
        >
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Drag ${name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            {expanded ? "Collapse" : "Expand"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Actions for ${name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move all…</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto">
                  {destinations.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onSelect={() => onMoveAllTo(opt.value)}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={onLogAll}>Log all</DropdownMenuItem>
              <DropdownMenuItem onSelect={onUngroup}>Ungroup</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--color-error)] focus:text-[var(--color-error)]"
                onSelect={onRemoveAll}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {expanded ? (
          <ul className="mt-3 space-y-2 border-t border-border pt-3">
            {meals.map((meal) => {
              const label = labelFor(meal);
              return (
                <li
                  key={meal.id}
                  className="flex min-w-0 items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{label.title}</p>
                    {label.subtitle ? (
                      <p className="truncate text-sm text-muted-foreground">
                        {label.subtitle}
                      </p>
                    ) : null}
                  </div>
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
                    <DropdownMenuContent align="end" className="min-w-[12rem]">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Move to…</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="max-h-[min(20rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto">
                          {destinations.map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onSelect={() => onMoveMemberTo(meal.id, opt.value)}
                            >
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-[var(--color-error)] focus:text-[var(--color-error)]"
                        onSelect={() => onDeleteMember(meal.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        ) : null}
      </PlanSlotTile>
    </div>
  );
}

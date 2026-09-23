import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRecipeData, useRepos } from "@/data";
import {
  addStock,
  carryOverChecked,
  defaultShoppingWindow,
  emptyShoppingOverlay,
  formatQuantity,
  shiftShoppingWindow,
  toCanonical,
  windowKey,
  withAdjustment,
  withChecked,
  withManualLine,
  withSuppressed,
  type CanonicalQuantity,
  type Quantity,
  type ShoppingOverlay,
  type ShoppingWindow,
} from "@/domain";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import {
  useIngredientsForPlan,
  usePlannedMeals,
  useRecipesForPlan,
} from "@/features/plan/hooks";
import { Button } from "@/ui/button";
import { cn } from "@/ui/lib/utils";
import { groupByCategory, groupByRecipe } from "./grouping";
import {
  useIngredientCategories,
  usePantryStockAll,
  useSettings,
  useShoppingDerivedLines,
  useShoppingLineViews,
  useShoppingOverlay,
  type ShoppingLineView,
} from "./hooks";
import { ManualAddForm } from "./ManualAddForm";
import { ShoppingLineRow } from "./ShoppingLineRow";
import { ShoppingWindowControl } from "./ShoppingWindowControl";

const listStateConfig = {
  empty: {
    title: "Nothing to buy — your plan is covered by what's in the pantry.",
  },
  loading: { rows: 5 },
  error: {
    title: "Could not build shopping list",
    description: "Requirements are computed from local plan and pantry data.",
  },
} as const;

type GroupMode = "category" | "recipe";

type CarryOverPrompt = {
  previous: ShoppingOverlay;
  nextWindow: ShoppingWindow;
};

export default function ShoppingPage() {
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const settings = useSettings();
  const meals = usePlannedMeals();
  const recipes = useRecipesForPlan();
  const ingredients = useIngredientsForPlan();
  const categories = useIngredientCategories();
  const pantry = usePantryStockAll();

  const window = useMemo((): ShoppingWindow | null => {
    if (!settings) return null;
    return settings.shoppingWindow ?? defaultShoppingWindow();
  }, [settings]);

  const [groupMode, setGroupMode] = useState<GroupMode>("category");
  const [showManual, setShowManual] = useState(false);
  const [carryOver, setCarryOver] = useState<CarryOverPrompt | null>(null);

  const overlay = useShoppingOverlay(window ?? undefined);
  const derived = useShoppingDerivedLines(
    meals,
    window ?? undefined,
    recipes,
    ingredients,
    pantry,
    overlay,
  );
  const lineViews = useShoppingLineViews(derived, ingredients, categories);

  const recipeNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const recipe of recipes ?? []) {
      map.set(recipe.id, recipe.name);
    }
    return map;
  }, [recipes]);

  const groups = useMemo(() => {
    if (!lineViews) return undefined;
    return groupMode === "category"
      ? groupByCategory(lineViews)
      : groupByRecipe(lineViews, recipeNames);
  }, [lineViews, groupMode, recipeNames]);

  const remainingCount = useMemo(() => {
    if (!lineViews) return null;
    return lineViews.filter((line) => !line.checked).length;
  }, [lineViews]);

  const persistWindow = useCallback(
    async (next: ShoppingWindow) => {
      if (!repos || !settings) return;
      await repos.settings.put({ ...settings, shoppingWindow: next });
    },
    [repos, settings],
  );

  const ensureOverlay = useCallback(async (): Promise<ShoppingOverlay | null> => {
    if (!repos || !window) return null;
    const key = windowKey(window);
    const existing = await repos.shoppingOverlays.byWindowKey(key);
    if (existing) return existing;
    const created = emptyShoppingOverlay(key);
    await repos.shoppingOverlays.put(created);
    return created;
  }, [repos, window]);

  const saveOverlay = useCallback(
    async (next: ShoppingOverlay) => {
      if (!repos) return;
      await repos.shoppingOverlays.put(next);
    },
    [repos],
  );

  const requestWindowChange = useCallback(
    async (next: ShoppingWindow) => {
      if (!window || !repos) {
        await persistWindow(next);
        return;
      }
      if (windowKey(window) === windowKey(next)) return;

      const current = await repos.shoppingOverlays.byWindowKey(
        windowKey(window),
      );
      if (current && current.checked.length > 0) {
        setCarryOver({ previous: current, nextWindow: next });
        return;
      }
      await persistWindow(next);
    },
    [window, repos, persistWindow],
  );

  const confirmCarryOver = async (carry: boolean) => {
    if (!carryOver) return;
    const { previous, nextWindow } = carryOver;
    setCarryOver(null);
    await persistWindow(nextWindow);

    if (!carry || !repos) return;
    const key = windowKey(nextWindow);
    const existing =
      (await repos.shoppingOverlays.byWindowKey(key)) ??
      emptyShoppingOverlay(key);
    await saveOverlay(carryOverChecked(previous, existing));
  };

  const onTick = async (line: ShoppingLineView) => {
    if (!repos || !ingredients) return;
    const ingredient = line.ingredient;
    const existing =
      (await repos.pantryStock.byIngredientId(ingredient.id)) ?? undefined;

    const unit =
      line.buyQuantity.kind === "mass"
        ? "g"
        : line.buyQuantity.kind === "volume"
          ? "ml"
          : "item";
    const quantity: Quantity = {
      value: line.buyQuantity.amount,
      unit,
    };
    const result = addStock(
      existing,
      ingredient,
      quantity,
      new Date().toISOString(),
    );
    if (!result.ok) {
      toast.error("Could not update pantry from this tick");
      return;
    }
    await repos.pantryStock.put(result.stock);

    const base =
      (await ensureOverlay()) ??
      emptyShoppingOverlay(window ? windowKey(window) : "unknown");
    await saveOverlay(withChecked(base, line.ingredientId, true));
    toast.success(
      `Added ${formatQuantity(line.buyQuantity)} ${ingredient.name} to pantry`,
    );
  };

  const onSuppress = async (line: ShoppingLineView) => {
    const base = await ensureOverlay();
    if (!base) return;
    await saveOverlay(withSuppressed(base, line.ingredientId, true));
  };

  const onAdjust = async (
    line: ShoppingLineView,
    quantity: CanonicalQuantity | null,
  ) => {
    const base = await ensureOverlay();
    if (!base) return;
    await saveOverlay(withAdjustment(base, line.ingredientId, quantity));
  };

  const onManualAdd = async (ingredientId: string, quantity: Quantity) => {
    if (!ingredients) return;
    const ingredient = ingredients.find((i) => i.id === ingredientId);
    if (!ingredient) return;
    const converted = toCanonical(quantity, ingredient);
    if (!converted.ok) {
      toast.error("That unit does not match the ingredient");
      return;
    }
    const base = await ensureOverlay();
    if (!base) return;
    await saveOverlay(
      withManualLine(base, ingredientId, converted.canonical),
    );
    setShowManual(false);
  };

  if (dataError) {
    return (
      <div className="app-page">
        <PageHeader
          title="Shopping"
          description="Derived list from your plan and pantry."
        />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (!ready || !window || lineViews === undefined || groups === undefined) {
    return (
      <div className="app-page">
        <PageHeader
          title="Shopping"
          description="Derived list from your plan and pantry."
        />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  return (
    <div className="app-page">
      <PageHeader
        title="Shopping"
        description="Live list from your plan minus what is already in the pantry."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowManual(true)}
          >
            <Plus className="size-4" />
            Add item
          </Button>
        }
      />

      <div className="space-y-6">
        <ShoppingWindowControl
          window={window}
          onChange={(next) => void requestWindowChange(next)}
          onNudgeWeek={(dir) =>
            void requestWindowChange(shiftShoppingWindow(window, dir * 7))
          }
        />

        <div
          className="inline-flex rounded-md border border-border p-1"
          role="group"
          aria-label="Group shopping list"
        >
          {(
            [
              ["category", "By aisle"],
              ["recipe", "By recipe"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "min-h-11 rounded-sm px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                groupMode === mode
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground",
              )}
              aria-pressed={groupMode === mode}
              onClick={() => setGroupMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        {remainingCount != null && lineViews.length > 0 ? (
          <p
            className="text-base text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="num text-foreground font-medium">
              {remainingCount}
            </span>{" "}
            item{remainingCount === 1 ? "" : "s"} left to buy
          </p>
        ) : null}

        {showManual && ingredients && ingredients.length > 0 ? (
          <ManualAddForm
            ingredients={ingredients}
            onAdd={(id, qty) => void onManualAdd(id, qty)}
            onCancel={() => setShowManual(false)}
          />
        ) : null}

        {carryOver ? (
          <div
            role="status"
            className="space-y-3 rounded-lg border border-border bg-[var(--color-surface-raised)] p-4"
          >
            <p className="text-base">
              {carryOver.previous.checked.length} ticked item
              {carryOver.previous.checked.length === 1 ? "" : "s"} in the
              previous range. Carry them over?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void confirmCarryOver(true)}>
                Carry over
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void confirmCarryOver(false)}
              >
                Start fresh
              </Button>
            </div>
          </div>
        ) : null}

        {lineViews.length === 0 ? (
          <RouteStatePanel state="empty" config={listStateConfig} />
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.key} className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="divide-y-0">
                  {group.lines.map((line) => (
                    <ShoppingLineRow
                      key={`${group.key}-${line.ingredientId}-${line.manualEntryId ?? "derived"}`}
                      line={line}
                      onTick={(l) => void onTick(l)}
                      onSuppress={(l) => void onSuppress(l)}
                      onAdjust={(l, q) => void onAdjust(l, q)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Check, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRecipeData, useRepos } from "@/data";
import { SEED_SLOT_IDS } from "@/data/seeds";
import {
  FLAVOUR_TAGS,
  buildRecipeFields,
  createId,
  defaultMixLineDraft,
  describeSodium,
  draftsToRecipeInput,
  entryMeasuresFor,
  filterFlavourIngredients,
  flavourMarkers,
  formatKcal,
  kcalPerSpoon,
  mergeLineDrafts,
  type FlavourLabFilters,
  type FlavourTag,
  type Ingredient,
  type MealTemplate,
  type Recipe,
  type RecipeLineDraft,
} from "@/domain";
import { IngredientPicker } from "@/features/ingredients/IngredientPicker";
import { RecipeNutritionPanel } from "@/features/recipes/RecipeNutritionPanel";
import {
  useActiveIngredients,
  useIngredientsById,
} from "@/features/recipes/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { cn } from "@/ui/lib/utils";
import {
  readPickerRecents,
  rememberPickerRecent,
} from "@/ui/picker-recents";
import { EntryMeasureChoice } from "@/ui/unit-choice";

const listStateConfig = {
  empty: {
    title: "No ingredients match these filters.",
    description:
      "Widen the tag or calorie filters, or seed the flavour pack from Settings.",
  },
  loading: { rows: 6 },
  error: {
    title: "Could not load Flavour Lab",
    description: "Local storage may be unavailable in this browser.",
  },
} as const;

function parseOptionalCeiling(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function IngredientResultRow({
  ingredient,
  selected,
  onToggle,
}: {
  ingredient: Ingredient;
  selected: boolean;
  onToggle: () => void;
}) {
  const markers = flavourMarkers(ingredient.nutrition);
  const perTsp = kcalPerSpoon(ingredient, "tsp");
  const sodium = describeSodium({
    sodiumMg: ingredient.nutrition.sodiumMg,
  });

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link
            to={`/ingredients/${ingredient.id}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {ingredient.name}
          </Link>
          {ingredient.flavourTags.length > 0 ? (
            <span className="text-xs capitalize text-muted-foreground">
              {ingredient.flavourTags.join(" · ")}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="num">{formatKcal(ingredient.nutrition.kcal)}</span>{" "}
          kcal/100
          {perTsp != null ? (
            <>
              {" "}
              · <span className="num">{formatKcal(perTsp)}</span> kcal/tsp
            </>
          ) : null}
          {" · "}
          {sodium.kind === "unknown" ? "Sodium not known" : sodium.label}
        </p>
        {(markers.calorieDense ||
          markers.highSodium ||
          markers.sodiumUnknown) && (
          <p className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {markers.calorieDense ? (
              <span className="rounded-md border border-border px-2 py-0.5">
                Calorie-dense
              </span>
            ) : null}
            {markers.highSodium ? (
              <span className="rounded-md border border-border px-2 py-0.5">
                High sodium
              </span>
            ) : null}
            {markers.sodiumUnknown ? (
              <span className="rounded-md border border-border px-2 py-0.5">
                Sodium unknown
              </span>
            ) : null}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant={selected ? "default" : "outline"}
        className="shrink-0"
        aria-pressed={selected}
        onClick={onToggle}
      >
        {selected ? (
          <>
            <Check className="size-4" aria-hidden="true" />
            In mix
          </>
        ) : (
          <>
            <Plus className="size-4" aria-hidden="true" />
            Add to mix
          </>
        )}
      </Button>
    </li>
  );
}

export default function FlavourLabPage() {
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const ingredients = useActiveIngredients();
  const ingredientsById = useIngredientsById();

  const [tags, setTags] = useState<FlavourTag[]>([]);
  const [kcalRaw, setKcalRaw] = useState("");
  const [sodiumRaw, setSodiumRaw] = useState("");
  const [commonOnly, setCommonOnly] = useState(true);

  const [mixName, setMixName] = useState("");
  const [mixServings, setMixServings] = useState(3);
  const [mixLines, setMixLines] = useState<RecipeLineDraft[]>([]);
  const [savingMix, setSavingMix] = useState(false);

  const [snackOpen, setSnackOpen] = useState(false);
  const [snackName, setSnackName] = useState("");
  const [baseIngredientId, setBaseIngredientId] = useState("");
  const [baseAmount, setBaseAmount] = useState("200");
  const [snackServings, setSnackServings] = useState("1");
  const [ingredientRecents, setIngredientRecents] = useState(() =>
    readPickerRecents("ingredients"),
  );
  const [savingSnack, setSavingSnack] = useState(false);
  const [savedMixId, setSavedMixId] = useState<string | null>(null);

  const filters: FlavourLabFilters = useMemo(
    () => ({
      tags,
      maxKcal: parseOptionalCeiling(kcalRaw),
      maxSodiumMg: parseOptionalCeiling(sodiumRaw),
      commonOnly,
    }),
    [tags, kcalRaw, sodiumRaw, commonOnly],
  );

  const filtered = useMemo(() => {
    if (!ingredients) return undefined;
    return filterFlavourIngredients(ingredients, filters);
  }, [ingredients, filters]);

  const selectedIds = useMemo(
    () => new Set(mixLines.map((line) => line.ingredientId)),
    [mixLines],
  );

  const previewRecipe = useMemo(() => {
    if (!ingredientsById) return null;
    return draftsToRecipeInput(
      mixName.trim() || "Draft mix",
      mixServings > 0 ? mixServings : 1,
      mixLines,
      ingredientsById,
    );
  }, [mixName, mixServings, mixLines, ingredientsById]);

  const toggleIngredient = (ingredient: Ingredient) => {
    if (selectedIds.has(ingredient.id)) {
      setMixLines((lines) =>
        lines.filter((line) => line.ingredientId !== ingredient.id),
      );
      return;
    }
    const draft = defaultMixLineDraft(ingredient);
    setMixLines((lines) => {
      const existingIndex = lines.findIndex(
        (line) => line.ingredientId === ingredient.id,
      );
      if (existingIndex >= 0) {
        const next = [...lines];
        next[existingIndex] = mergeLineDrafts(
          lines[existingIndex]!,
          draft,
          ingredient.measureKind,
          ingredient,
        );
        return next;
      }
      return [...lines, draft];
    });
  };

  const updateLine = (index: number, patch: Partial<RecipeLineDraft>) => {
    setMixLines((lines) =>
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const removeLine = (index: number) => {
    setMixLines((lines) => lines.filter((_, i) => i !== index));
  };

  const saveMix = async (): Promise<string | null> => {
    if (!repos || !ingredientsById) {
      toast.error("Data is not ready yet");
      return null;
    }
    const name = mixName.trim();
    if (!name) {
      toast.error("Name the mix before saving");
      return null;
    }
    if (mixLines.length === 0) {
      toast.error("Add at least one ingredient to the mix");
      return null;
    }
    const built = buildRecipeFields(
      {
        name,
        servings: mixServings > 0 ? mixServings : 1,
        kind: "mix",
        lines: mixLines,
        steps: [],
        tagsText: "",
        notes: "",
      },
      ingredientsById,
    );
    if (!built.ok) {
      toast.error(built.errors[0]?.message ?? "Could not build mix");
      return null;
    }

    setSavingMix(true);
    try {
      const now = new Date().toISOString();
      const row: Recipe = {
        id: savedMixId ?? createId(),
        ...built.fields,
        imageId: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      // Preserve createdAt when re-saving the same mix for a snack.
      if (savedMixId) {
        const existing = await repos.recipes.byId(savedMixId);
        if (existing) {
          row.createdAt = existing.createdAt;
          row.imageId = existing.imageId;
        }
      }
      await repos.recipes.put(row);
      setSavedMixId(row.id);
      toast.success("Mix saved as a recipe");
      return row.id;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save mix",
      );
      return null;
    } finally {
      setSavingMix(false);
    }
  };

  const saveMixAndOpen = async () => {
    const id = await saveMix();
    if (id) void navigate(`/recipes/${id}`);
  };

  const saveAsSnack = async () => {
    if (!repos || !ingredientsById) {
      toast.error("Data is not ready yet");
      return;
    }
    const name = snackName.trim();
    if (!name) {
      toast.error("Name the snack");
      return;
    }
    if (!baseIngredientId) {
      toast.error("Pick a base food");
      return;
    }
    const amount = Number(baseAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid base amount");
      return;
    }
    const servings = Number(snackServings);
    if (!Number.isFinite(servings) || servings <= 0) {
      toast.error("Enter mix servings greater than zero");
      return;
    }

    setSavingSnack(true);
    try {
      const mixId = await saveMix();
      if (!mixId) return;

      const base = ingredientsById.get(baseIngredientId);
      if (!base) {
        toast.error("Base ingredient is missing");
        return;
      }
      const unit =
        base.measureKind === "volume"
          ? "ml"
          : base.measureKind === "count"
            ? "item"
            : "g";

      const now = new Date().toISOString();
      const template: MealTemplate = {
        id: createId(),
        name,
        components: [
          {
            id: createId(),
            entry: {
              kind: "ingredient",
              ingredientId: baseIngredientId,
              quantity: { value: amount, unit },
            },
            note: null,
          },
          {
            id: createId(),
            entry: {
              kind: "recipeServings",
              recipeId: mixId,
              servings,
            },
            note: null,
          },
        ],
        defaultSlotId: SEED_SLOT_IDS.snack,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      await repos.mealTemplates.put(template);
      toast.success("Snack saved as a meal");
      setSnackOpen(false);
      void navigate(`/meals/${template.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save snack",
      );
    } finally {
      setSavingSnack(false);
    }
  };

  if (dataError) {
    return (
      <div className="app-page content">
        <PageHeader title="Flavour Lab" />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (!ready || ingredients === undefined || ingredientsById === undefined) {
    return (
      <div className="app-page content">
        <PageHeader title="Flavour Lab" />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  return (
    <div className="app-page content">
      <PageHeader
        title="Flavour Lab"
        description={
          <>
            <p>
              Filter seasonings by taste and ceilings, then build a low-calorie
              mix. A{" "}
              <strong className="font-medium text-foreground">
                mix is an ordinary recipe
              </strong>{" "}
              (open it later under Recipes). A{" "}
              <strong className="font-medium text-foreground">
                snack is an ordinary saved meal
              </strong>{" "}
              pairing a base food with that mix — not a nested recipe.
            </p>
          </>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] lg:items-start">
        <div className="min-w-0 space-y-8">
          <section className="space-y-4" aria-labelledby="flavour-filters-heading">
            <h2
              id="flavour-filters-heading"
              className="text-lg font-semibold text-foreground"
            >
              Filters
            </h2>

            <div className="space-y-2">
              <Label id="flavour-tags-label">Flavour tags</Label>
              <p
                id="flavour-tags-help"
                className="text-sm text-muted-foreground"
              >
                Multi-select — results must match every selected tag.
              </p>
              <ToggleGroup.Root
                type="multiple"
                id="flavour-tags"
                value={tags}
                onValueChange={(next) => setTags(next as FlavourTag[])}
                aria-labelledby="flavour-tags-label"
                aria-describedby="flavour-tags-help"
                className="flex flex-wrap gap-2"
                data-testid="flavour-lab-tags"
              >
                {FLAVOUR_TAGS.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <ToggleGroup.Item
                      key={tag}
                      value={tag}
                      className={cn(
                        "inline-flex min-h-11 flex-none items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selected
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                          : "border-border bg-[var(--color-surface-raised)] text-foreground hover:bg-muted",
                      )}
                    >
                      {selected ? (
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                      ) : null}
                      <span>{tag}</span>
                    </ToggleGroup.Item>
                  );
                })}
              </ToggleGroup.Root>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-[8rem] flex-1 space-y-2 sm:max-w-[12rem]">
                <Label htmlFor="flavour-kcal-ceiling">
                  Max kcal (per tsp or /100 g)
                </Label>
                <Input
                  id="flavour-kcal-ceiling"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={kcalRaw}
                  onChange={(event) => setKcalRaw(event.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
              <div className="min-w-[8rem] flex-1 space-y-2 sm:max-w-[12rem]">
                <Label htmlFor="flavour-sodium-ceiling">
                  Max sodium (mg /100)
                </Label>
                <Input
                  id="flavour-sodium-ceiling"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={sodiumRaw}
                  onChange={(event) => setSodiumRaw(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input"
                  checked={commonOnly}
                  onChange={(event) => setCommonOnly(event.target.checked)}
                />
                Common / pack only
              </label>
            </div>
          </section>

          <section aria-labelledby="flavour-results-heading">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="flavour-results-heading"
                className="text-lg font-semibold text-foreground"
              >
                Ingredients
              </h2>
              <p className="text-sm text-muted-foreground">
                {filtered?.length ?? 0} match
                {(filtered?.length ?? 0) === 1 ? "" : "es"}
              </p>
            </div>
            {(filtered?.length ?? 0) === 0 ? (
              <RouteStatePanel state="empty" config={listStateConfig} />
            ) : (
              <ul className="app-list-measure divide-y divide-border border-t border-border">
                {filtered!.map((ingredient) => (
                  <IngredientResultRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    selected={selectedIds.has(ingredient.id)}
                    onToggle={() => toggleIngredient(ingredient)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside
          className={cn(
            "order-first space-y-4 rounded-lg border border-border bg-[var(--color-surface-raised)] p-4",
            "lg:order-none lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:overscroll-contain",
          )}
          aria-labelledby="flavour-mix-heading"
        >
          <div className="space-y-1">
            <h2
              id="flavour-mix-heading"
              className="text-lg font-semibold text-foreground"
            >
              Build a mix
            </h2>
            <p className="text-sm text-muted-foreground">
              Tap ingredients to add them with a default quantity. Edit amounts
              here — saving creates a recipe you can open in Recipes.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label htmlFor="flavour-mix-name">Mix name</Label>
              <Input
                id="flavour-mix-name"
                value={mixName}
                onChange={(event) => setMixName(event.target.value)}
                placeholder="e.g. Chilli Garlic Vinegar"
                autoComplete="off"
              />
            </div>
            <div className="w-24 space-y-1">
              <Label htmlFor="flavour-mix-servings">Servings</Label>
              <Input
                id="flavour-mix-servings"
                type="number"
                inputMode="decimal"
                min={0.1}
                step="any"
                value={mixServings}
                onChange={(event) =>
                  setMixServings(Number(event.target.value) || 1)
                }
              />
            </div>
          </div>

          {mixLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in the mix yet — use Add to mix on the list.
            </p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {mixLines.map((line, index) => {
                const ingredient = ingredientsById.get(line.ingredientId);
                const measures = ingredient
                  ? entryMeasuresFor(ingredient)
                  : (["g"] as const);
                const name = ingredient?.name ?? "Unknown";
                return (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-center gap-2 py-2"
                  >
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {name}
                    </p>
                    <Input
                      id={`flavour-mix-amount-${line.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      className="h-9 w-16 shrink-0"
                      aria-label={`${name} amount`}
                      value={line.amount}
                      onChange={(event) =>
                        updateLine(index, {
                          amount: Number(event.target.value) || 0,
                        })
                      }
                    />
                    <EntryMeasureChoice
                      id={`flavour-mix-measure-${line.id}`}
                      aria-label={`${name} measure`}
                      measures={measures}
                      value={line.entryMeasure}
                      onValueChange={(measure) =>
                        updateLine(index, { entryMeasure: measure })
                      }
                      className="w-[5.5rem] shrink-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {previewRecipe ? (
            <RecipeNutritionPanel
              recipe={previewRecipe}
              ingredientsById={ingredientsById}
            />
          ) : mixLines.length > 0 ? (
            <p className="text-sm text-[var(--color-error)]" role="alert">
              Check amounts — nutrition cannot be calculated yet.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={savingMix || mixLines.length === 0}
              onClick={() => void saveMixAndOpen()}
            >
              {savingMix ? "Saving…" : "Save mix"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={savingMix || mixLines.length === 0}
              onClick={() => {
                if (!mixName.trim()) {
                  toast.error("Name the mix before saving a snack");
                  return;
                }
                setSnackName(
                  snackName.trim() || `${mixName.trim()} snack`,
                );
                setSnackOpen(true);
              }}
            >
              Save as snack…
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={snackOpen} onOpenChange={setSnackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as snack</DialogTitle>
            <DialogDescription>
              Creates a saved meal: a base food plus servings of this mix. The
              mix is saved as a recipe first — no recipe nesting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-2">
              <Label htmlFor="flavour-snack-name">Snack name</Label>
              <Input
                id="flavour-snack-name"
                value={snackName}
                onChange={(event) => setSnackName(event.target.value)}
                placeholder="e.g. Chilli Garlic Cucumber"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label id="flavour-snack-base-label">Base food</Label>
              <IngredientPicker
                id="flavour-snack-base"
                aria-labelledby="flavour-snack-base-label"
                title="Choose base food"
                placeholder="Choose base food…"
                value={baseIngredientId}
                onValueChange={(id) => {
                  setBaseIngredientId(id);
                  setIngredientRecents(
                    rememberPickerRecent("ingredients", id),
                  );
                }}
                ingredients={ingredients}
                recentIds={ingredientRecents}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="w-28 space-y-2">
                <Label htmlFor="flavour-snack-amount">Base amount</Label>
                <Input
                  id="flavour-snack-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={baseAmount}
                  onChange={(event) => setBaseAmount(event.target.value)}
                />
              </div>
              <div className="w-28 space-y-2">
                <Label htmlFor="flavour-snack-servings">Mix servings</Label>
                <Input
                  id="flavour-snack-servings"
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  step="any"
                  value={snackServings}
                  onChange={(event) => setSnackServings(event.target.value)}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Base unit follows the ingredient (g / ml / item). Default snack
              slot is Snack.
            </p>
          </div>
          <DialogFooter className="border-t border-border px-4 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSnackOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingSnack}
              onClick={() => void saveAsSnack()}
            >
              {savingSnack ? "Saving…" : "Save snack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRepos, useRecipeData } from "@/data";
import {
  CANONICAL_UNIT,
  createId,
  formatShortfallLabels,
  fromCanonical,
  planCookBatch,
  preferredDisplayUnit,
  seedActualLines,
  toCanonical,
  unitsForKind,
  type Ingredient,
  type MeasureKind,
  type Recipe,
  type Shortfall,
  type SnapshotActualLine,
  type Unit,
} from "@/domain";
import {
  PortionStepper,
  ShortfallNotice,
} from "@/features/components/domain-stubs";
import { usePantryStockByIngredientId } from "@/features/pantry/hooks";
import {
  useIngredientsById,
  useRecipes,
} from "@/features/recipes/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { NativeSelect } from "@/ui/native-select";
import { Textarea } from "@/ui/textarea";

const pageStateConfig = {
  empty: {
    title: "No recipes yet. Recipes are built from your ingredients.",
    description: "Add a recipe first, then come back to cook a batch.",
    actionLabel: "Go to recipes",
  },
  loading: { rows: 6 },
  error: {
    title: "Could not start cook flow",
    description: "Local storage may be unavailable in this browser.",
  },
} as const;

type EditableLine = {
  ingredientId: string;
  amount: number;
  unit: Unit;
};

function displayUnitForLine(
  recipe: Recipe,
  ingredientId: string,
  quantityKind: MeasureKind,
): Unit {
  const recipeLine = recipe.lines.find(
    (line) => line.ingredientId === ingredientId,
  );
  if (recipeLine?.displayUnit) return recipeLine.displayUnit;
  return preferredDisplayUnit({ amount: 0, kind: quantityKind });
}

function seedEditableLines(
  recipe: Recipe,
  scale: number,
  ingredientsById: ReadonlyMap<string, Ingredient>,
): EditableLine[] {
  return seedActualLines(recipe, scale).map((line) => {
    const ingredient = ingredientsById.get(line.ingredientId);
    const unit = displayUnitForLine(
      recipe,
      line.ingredientId,
      ingredient?.measureKind ?? line.quantity.kind,
    );
    const converted = fromCanonical(line.quantity, unit);
    const amount = converted.ok ? converted.quantity.value : line.quantity.amount;
    return {
      ingredientId: line.ingredientId,
      amount,
      unit: converted.ok ? converted.quantity.unit : CANONICAL_UNIT[line.quantity.kind],
    };
  });
}

/** Default batch divide = recipe servings × cook scale; still editable afterward. */
function defaultPortions(recipe: Pick<Recipe, "servings">, scaleFactor: number): number {
  const value = recipe.servings * scaleFactor;
  return value > 0 ? value : 1;
}

function toActualLines(
  lines: EditableLine[],
  ingredientsById: ReadonlyMap<string, Ingredient>,
): SnapshotActualLine[] | { error: string } {
  const actual: SnapshotActualLine[] = [];
  for (const line of lines) {
    const ingredient = ingredientsById.get(line.ingredientId);
    if (!ingredient) {
      return { error: `Missing ingredient for line ${line.ingredientId}` };
    }
    if (!Number.isFinite(line.amount) || line.amount < 0) {
      return { error: `Enter a non-negative amount for ${ingredient.name}` };
    }
    const converted = toCanonical(
      { value: line.amount, unit: line.unit },
      ingredient,
    );
    if (!converted.ok) {
      return {
        error: `Use a ${converted.expected} unit for ${ingredient.name}`,
      };
    }
    actual.push({
      ingredientId: line.ingredientId,
      quantity: converted.canonical,
    });
  }
  return actual;
}

export default function CookNewPage() {
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const recipes = useRecipes();
  const ingredientsById = useIngredientsById();
  const stockById = usePantryStockByIngredientId();

  const activeRecipes = useMemo(
    () => (recipes ?? []).filter((recipe) => recipe.archivedAt == null),
    [recipes],
  );

  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [portionsNominal, setPortionsNominal] = useState(1);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [linesSeedKey, setLinesSeedKey] = useState("");
  const [pendingShortfalls, setPendingShortfalls] = useState<Shortfall[] | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const selectedRecipe =
    activeRecipes.find((recipe) => recipe.id === recipeId) ??
    activeRecipes[0] ??
    null;

  const seedKey =
    selectedRecipe && ingredientsById
      ? `${selectedRecipe.id}:${scale}`
      : "";

  if (
    selectedRecipe &&
    ingredientsById &&
    seedKey !== "" &&
    seedKey !== linesSeedKey
  ) {
    setLinesSeedKey(seedKey);
    setLines(seedEditableLines(selectedRecipe, scale, ingredientsById));
    setPortionsNominal(defaultPortions(selectedRecipe, scale));
    setPendingShortfalls(null);
  }

  const shortfallMessage = useMemo(() => {
    if (!pendingShortfalls || !ingredientsById) return "";
    const labels = formatShortfallLabels(pendingShortfalls, ingredientsById);
    if (labels.length === 0) return "";
    return `You are missing: ${labels.join(", ")}. Adjust pantry or cook anyway.`;
  }, [pendingShortfalls, ingredientsById]);

  const persistCook = async (force: boolean) => {
    if (!repos || !selectedRecipe || !ingredientsById || stockById === undefined) {
      toast.error("Data is still loading");
      return;
    }
    if (!(scale > 0)) {
      toast.error("Scale must be greater than zero");
      return;
    }
    if (!(portionsNominal > 0)) {
      toast.error("Portions must be greater than zero");
      return;
    }

    const actual = toActualLines(lines, ingredientsById);
    if ("error" in actual) {
      toast.error(actual.error);
      return;
    }

    const plan = planCookBatch(
      {
        id: createId(),
        recipe: selectedRecipe,
        ingredientsById,
        scale,
        portionsNominal,
        actualLines: actual,
        cookedAt: new Date().toISOString(),
        label: label.trim() ? label.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
      },
      stockById,
    );

    if (!force && plan.shortfalls.length > 0) {
      setPendingShortfalls(plan.shortfalls);
      return;
    }

    setBusy(true);
    try {
      await repos.batches.create(plan.batch);
      for (const row of plan.pantryAfter) {
        await repos.pantryStock.put(row);
      }
      toast.success(`Cooked ${plan.batch.snapshot.recipeName}`);
      void navigate(`/cook/${plan.batch.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save batch",
      );
    } finally {
      setBusy(false);
      setPendingShortfalls(null);
    }
  };

  if (dataError) {
    return (
      <div className="app-page">
        <PageHeader title="Cook a recipe" />
        <RouteStatePanel state="error" config={pageStateConfig} />
      </div>
    );
  }

  if (
    !ready ||
    recipes === undefined ||
    ingredientsById === undefined ||
    stockById === undefined
  ) {
    return (
      <div className="app-page">
        <PageHeader title="Cook a recipe" />
        <RouteStatePanel state="loading" config={pageStateConfig} />
      </div>
    );
  }

  if (activeRecipes.length === 0) {
    return (
      <div className="app-page">
        <PageHeader title="Cook a recipe" />
        <RouteStatePanel
          state="empty"
          config={pageStateConfig}
          onAction={() => {
            void navigate("/recipes");
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-page space-y-8">
      <PageHeader
        title="Cook a recipe"
        description="Confirm what you actually used. Nutrition freezes into a batch snapshot."
        actions={
          <Button type="button" variant="outline" asChild>
            <Link to="/cook">Cancel</Link>
          </Button>
        }
      />

      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cook-recipe">Recipe</Label>
          <NativeSelect
            id="cook-recipe"
            value={selectedRecipe?.id ?? ""}
            onChange={(event) => {
              setRecipeId(event.target.value);
            }}
          >
            {activeRecipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cook-scale">Scale</Label>
            <Input
              id="cook-scale"
              type="number"
              inputMode="decimal"
              min={0.1}
              step="any"
              value={scale}
              onChange={(event) => {
                const next = Number(event.target.value);
                setScale(Number.isFinite(next) ? next : 1);
              }}
            />
            <p className="text-sm text-muted-foreground">
              1× = recipe as written (
              {selectedRecipe?.servings ?? "?"} servings). Doubling scale
              doubles ingredient quantities and resets portions to match.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Portions this batch yields</Label>
            <PortionStepper
              value={portionsNominal}
              min={0.5}
              onChange={setPortionsNominal}
            />
            <p className="text-sm text-muted-foreground">
              Defaults to servings × scale (
              {selectedRecipe
                ? defaultPortions(selectedRecipe, scale)
                : "—"}
              ). Adjust if you pack differently.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cook-label">Label (optional)</Label>
          <Input
            id="cook-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Sunday curry"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cook-notes">Notes (optional)</Label>
          <Textarea
            id="cook-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Actual quantities used</h2>
          <p className="text-sm text-muted-foreground">
            Seeded from the scaled recipe — edit anything that differed.
          </p>
        </div>
        <ul className="space-y-4">
          {lines.map((line, index) => {
            const ingredient = ingredientsById.get(line.ingredientId);
            const units = ingredient
              ? unitsForKind(ingredient.measureKind)
              : [line.unit];
            return (
              <li
                key={`${line.ingredientId}-${index}`}
                className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_7rem_auto]"
              >
                <div className="space-y-2 sm:col-span-3">
                  <p className="font-medium">
                    {ingredient?.name ?? "Unknown ingredient"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cook-line-amount-${index}`}>Quantity</Label>
                  <Input
                    id={`cook-line-amount-${index}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={Number.isFinite(line.amount) ? line.amount : ""}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setLines((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                amount: Number.isFinite(value) ? value : 0,
                              }
                            : row,
                        ),
                      );
                      setPendingShortfalls(null);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cook-line-unit-${index}`}>Unit</Label>
                  <NativeSelect
                    id={`cook-line-unit-${index}`}
                    value={line.unit}
                    onChange={(event) => {
                      const unit = event.target.value as Unit;
                      setLines((prev) =>
                        prev.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, unit } : row,
                        ),
                      );
                      setPendingShortfalls(null);
                    }}
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {pendingShortfalls && pendingShortfalls.length > 0 ? (
        <ShortfallNotice
          message={shortfallMessage}
          onAdjustPantry={() => {
            void navigate("/pantry");
          }}
          onCookAnyway={() => {
            void persistCook(true);
          }}
        />
      ) : null}

      <div className="sticky bottom-4 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={busy || !selectedRecipe}
          onClick={() => {
            void persistCook(false);
          }}
        >
          {busy ? "Saving…" : "Confirm cook"}
        </Button>
      </div>
    </div>
  );
}

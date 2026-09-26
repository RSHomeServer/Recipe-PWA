import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  portionsRemaining,
  recipePerServing,
  unitsForKind,
  type Ingredient,
  type LoggedMeal,
  type MealEntry,
  type MealSlot,
  type Recipe,
  type Unit,
} from "@/domain";
import { useRepos } from "@/data";
import type { BatchListRow } from "@/features/cook/hooks";
import { PortionStepper } from "@/features/components/domain-stubs";
import {
  ENTRY_SOURCE_QUESTION,
  LEXICON,
  logEntryKindOptions,
} from "@/features/shared/entry-kind-copy";
import { InfoPopover } from "@/features/shared/InfoPopover";
import { Button } from "@/ui/button";
import { IngredientPicker } from "@/features/ingredients/IngredientPicker";
import { CommandPicker } from "@/ui/command-picker";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  readPickerRecents,
  rememberPickerRecent,
} from "@/ui/picker-recents";
import { SegmentedGroup } from "@/ui/segmented-group";
import { UnitChoice } from "@/ui/unit-choice";
import { createLoggedMeal, updateLoggedMeal } from "./commands";

type EntryKind = MealEntry["kind"];

export type AddLoggedMealFormProps = {
  date: string;
  slotId: string;
  slots: MealSlot[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  batchRows: BatchListRow[];
  allLogs: LoggedMeal[];
  editing?: LoggedMeal | null;
  onDone: () => void;
  onCancel: () => void;
};

export function AddLoggedMealForm({
  date: initialDate,
  slotId: initialSlotId,
  slots,
  recipes,
  ingredients,
  batchRows,
  allLogs,
  editing = null,
  onDone,
  onCancel,
}: AddLoggedMealFormProps) {
  const repos = useRepos();
  const availableBatches = useMemo(
    () => batchRows.filter((row) => row.available || editing?.entry.kind === "batchPortions"),
    [batchRows, editing],
  );
  const hasAvailableBatches = availableBatches.length > 0;
  const kindOptions = useMemo(
    () =>
      logEntryKindOptions(
        hasAvailableBatches || editing?.entry.kind === "batchPortions",
      ),
    [hasAvailableBatches, editing?.entry.kind],
  );
  const ingredientsById = useMemo(() => {
    const map = new Map<string, Ingredient>();
    for (const ingredient of ingredients) map.set(ingredient.id, ingredient);
    return map;
  }, [ingredients]);
  const [recipeRecents, setRecipeRecents] = useState(() =>
    readPickerRecents("recipes"),
  );
  const [batchRecents, setBatchRecents] = useState(() =>
    readPickerRecents("batches"),
  );
  const [ingredientRecents, setIngredientRecents] = useState(() =>
    readPickerRecents("ingredients"),
  );

  const initialKind: EntryKind = editing?.entry.kind ?? "recipeServings";
  const [date, setDate] = useState(editing?.date ?? initialDate);
  const [slotId, setSlotId] = useState(editing?.slotId ?? initialSlotId);
  const [kind, setKind] = useState<EntryKind>(initialKind);
  const effectiveKind: EntryKind =
    kind === "batchPortions" &&
    !hasAvailableBatches &&
    editing?.entry.kind !== "batchPortions"
      ? "recipeServings"
      : kind;
  const [recipeId, setRecipeId] = useState(
    editing?.entry.kind === "recipeServings"
      ? editing.entry.recipeId
      : (recipes[0]?.id ?? ""),
  );
  const [servings, setServings] = useState(
    editing?.entry.kind === "recipeServings"
      ? String(editing.entry.servings)
      : "1",
  );
  const [batchId, setBatchId] = useState(
    editing?.entry.kind === "batchPortions"
      ? editing.entry.batchId
      : (availableBatches[0]?.batch.id ?? ""),
  );
  const [portions, setPortions] = useState(
    editing?.entry.kind === "batchPortions" ? editing.entry.portions : 1,
  );
  const [ingredientId, setIngredientId] = useState(
    editing?.entry.kind === "ingredient"
      ? editing.entry.ingredientId
      : (ingredients[0]?.id ?? ""),
  );
  const selectedIngredient =
    ingredients.find((i) => i.id === ingredientId) ?? ingredients[0];
  const units = selectedIngredient
    ? unitsForKind(selectedIngredient.measureKind)
    : [];
  const [amount, setAmount] = useState(
    editing?.entry.kind === "ingredient"
      ? String(editing.entry.quantity.value)
      : "",
  );
  const [unit, setUnit] = useState<Unit>(
    editing?.entry.kind === "ingredient"
      ? editing.entry.quantity.unit
      : (units[0] ?? "g"),
  );
  const [customName, setCustomName] = useState(
    editing?.entry.kind === "customFood" ? editing.entry.food.name : "",
  );
  const [customQty, setCustomQty] = useState(
    editing?.entry.kind === "customFood"
      ? String(editing.entry.food.quantity)
      : "1",
  );
  const [customKcal, setCustomKcal] = useState(
    editing?.entry.kind === "customFood"
      ? String(editing.entry.food.nutrition.kcal)
      : "",
  );
  const [customProtein, setCustomProtein] = useState(
    editing?.entry.kind === "customFood"
      ? String(editing.entry.food.nutrition.proteinG)
      : "",
  );
  const [customCarbs, setCustomCarbs] = useState(
    editing?.entry.kind === "customFood"
      ? String(editing.entry.food.nutrition.carbsG)
      : "",
  );
  const [customFat, setCustomFat] = useState(
    editing?.entry.kind === "customFood"
      ? String(editing.entry.food.nutrition.fatG)
      : "",
  );
  const [customSodium, setCustomSodium] = useState(
    editing?.entry.kind === "customFood" &&
      editing.entry.food.nutrition.sodiumMg != null
      ? String(editing.entry.food.nutrition.sodiumMg)
      : "",
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [busy, setBusy] = useState(false);

  const selectedBatchRow = batchRows.find((r) => r.batch.id === batchId);
  const remainingForWarn = useMemo(() => {
    if (!selectedBatchRow) return null;
    const others = allLogs.filter(
      (log) =>
        log.id !== editing?.id &&
        log.entry.kind === "batchPortions" &&
        log.entry.batchId === batchId,
    );
    return portionsRemaining(selectedBatchRow.batch, others);
  }, [selectedBatchRow, allLogs, editing?.id, batchId]);

  const portionsOverRemaining =
    effectiveKind === "batchPortions" &&
    remainingForWarn != null &&
    portions > remainingForWarn + 1e-6;

  const onIngredientChange = (id: string) => {
    setIngredientId(id);
    const next = ingredients.find((i) => i.id === id);
    if (next) {
      const nextUnits = unitsForKind(next.measureKind);
      setUnit(nextUnits[0] ?? "g");
    }
  };

  const buildEntry = (): MealEntry | null => {
    if (effectiveKind === "recipeServings") {
      const servingsNum = Number(servings);
      if (!recipeId || !Number.isFinite(servingsNum) || servingsNum <= 0) {
        toast.error("Pick a recipe and a positive servings amount");
        return null;
      }
      return { kind: "recipeServings", recipeId, servings: servingsNum };
    }
    if (effectiveKind === "batchPortions") {
      if (!batchId || !Number.isFinite(portions) || portions <= 0) {
        toast.error("Pick a batch and a positive portion amount");
        return null;
      }
      return { kind: "batchPortions", batchId, portions };
    }
    if (effectiveKind === "ingredient") {
      const value = Number(amount);
      if (!selectedIngredient || !Number.isFinite(value) || value < 0) {
        toast.error("Pick an ingredient and a non-negative amount");
        return null;
      }
      return {
        kind: "ingredient",
        ingredientId: selectedIngredient.id,
        quantity: { value, unit },
      };
    }
    const qty = Number(customQty);
    const kcal = Number(customKcal);
    const proteinG = Number(customProtein);
    const carbsG = Number(customCarbs);
    const fatG = Number(customFat);
    const sodiumRaw = customSodium.trim();
    const sodiumMg =
      sodiumRaw === ""
        ? null
        : Number(sodiumRaw);
    if (
      !customName.trim() ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !Number.isFinite(kcal) ||
      !Number.isFinite(proteinG) ||
      !Number.isFinite(carbsG) ||
      !Number.isFinite(fatG) ||
      (sodiumMg !== null && (!Number.isFinite(sodiumMg) || sodiumMg < 0))
    ) {
      toast.error("Enter a name and nutrition figures for the custom food");
      return null;
    }
    return {
      kind: "customFood",
      food: {
        name: customName.trim(),
        quantity: qty,
        nutrition: { kcal, proteinG, carbsG, fatG, sodiumMg },
      },
    };
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!repos) {
      toast.error("Data is not ready yet");
      return;
    }
    const entry = buildEntry();
    if (!entry) return;

    if (portionsOverRemaining) {
      toast.message("Logging more portions than remain", {
        description: "Allowed — remaining will go negative until corrected.",
      });
    }

    setBusy(true);
    try {
      if (editing) {
        await updateLoggedMeal(repos, editing, {
          date,
          slotId,
          entry,
          plannedMealId: editing.plannedMealId,
          note: note.trim() ? note.trim() : null,
          group: editing.group,
        });
        toast.success("Log updated");
      } else {
        await createLoggedMeal(repos, {
          date,
          slotId,
          entry,
          note: note.trim() ? note.trim() : null,
        });
        toast.success("Meal logged");
      }
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save log",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4 rounded-lg border border-border bg-[var(--color-surface-raised)] p-4"
      onSubmit={(event) => void onSubmit(event)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="log-date">Date</Label>
          <Input
            id="log-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label id="log-slot-label">Slot</Label>
          <SegmentedGroup
            id="log-slot"
            aria-labelledby="log-slot-label"
            value={slotId}
            onValueChange={setSlotId}
            options={slots.map((slot) => ({
              value: slot.id,
              label: slot.name,
            }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label id="log-kind-label">{ENTRY_SOURCE_QUESTION}</Label>
          <InfoPopover label="About where food comes from">
            <p className="font-medium text-foreground">Batch</p>
            <p className="mt-1 text-muted-foreground">{LEXICON.batch}</p>
            <p className="mt-3 font-medium text-foreground">Serving vs portion</p>
            <p className="mt-1 text-muted-foreground">
              {LEXICON.serving} {LEXICON.portion}
            </p>
          </InfoPopover>
        </div>
        <SegmentedGroup
          id="log-kind"
          aria-labelledby="log-kind-label"
          value={effectiveKind}
          onValueChange={(next) => setKind(next as EntryKind)}
          options={kindOptions}
        />
      </div>

      {effectiveKind === "recipeServings" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-2">
            <Label id="log-recipe-label">Recipe</Label>
            {recipes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recipes yet</p>
            ) : (
              <CommandPicker
                id="log-recipe"
                aria-labelledby="log-recipe-label"
                title="Choose recipe"
                value={recipeId}
                onValueChange={(id) => {
                  setRecipeId(id);
                  setRecipeRecents(rememberPickerRecent("recipes", id));
                }}
                recentIds={recipeRecents}
                items={recipes.map((recipe) => {
                  let context: string | undefined;
                  try {
                    const per = recipePerServing(
                      recipe,
                      Object.fromEntries(ingredientsById),
                    );
                    context = `${Math.round(per.kcal)} kcal / serving`;
                  } catch {
                    context = undefined;
                  }
                  return {
                    value: recipe.id,
                    label: recipe.name,
                    context,
                  };
                })}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-servings">Servings</Label>
            <Input
              id="log-servings"
              type="number"
              min={0.5}
              step={0.5}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {effectiveKind === "batchPortions" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label id="log-batch-label">Batch</Label>
            {availableBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No batches yet. Cook a recipe and its portions appear here.
              </p>
            ) : (
              <CommandPicker
                id="log-batch"
                aria-labelledby="log-batch-label"
                title="Choose batch"
                value={batchId}
                onValueChange={(id) => {
                  setBatchId(id);
                  setBatchRecents(rememberPickerRecent("batches", id));
                }}
                recentIds={batchRecents}
                items={availableBatches.map((row) => ({
                  value: row.batch.id,
                  label: row.batch.label ?? row.batch.snapshot.recipeName,
                  context: `${row.remaining} left · cooked ${row.batch.cookedAt.slice(0, 10)}`,
                }))}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Portions</Label>
            <PortionStepper
              value={portions}
              onChange={setPortions}
              min={0.5}
              step={0.5}
            />
            {remainingForWarn != null ? (
              <p className="text-sm text-muted-foreground">
                {remainingForWarn.toFixed(1)} remaining on this batch
              </p>
            ) : null}
            {portionsOverRemaining ? (
              <p
                role="status"
                className="text-sm text-[var(--color-warning)]"
              >
                More than remaining — allowed, but remaining will go negative.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {effectiveKind === "ingredient" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,8rem)]">
          <div className="space-y-2">
            <Label id="log-ingredient-label">Ingredient</Label>
            {ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ingredients yet</p>
            ) : (
              <IngredientPicker
                id="log-ingredient"
                aria-labelledby="log-ingredient-label"
                title="Choose ingredient"
                value={ingredientId}
                onValueChange={(id) => {
                  onIngredientChange(id);
                  setIngredientRecents(rememberPickerRecent("ingredients", id));
                }}
                recentIds={ingredientRecents}
                ingredients={ingredients}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-amount">Amount</Label>
            <Input
              id="log-amount"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label id="log-unit-label">Unit</Label>
            <UnitChoice
              id="log-unit"
              aria-labelledby="log-unit-label"
              units={units}
              value={unit}
              onValueChange={setUnit}
            />
          </div>
        </div>
      ) : null}

      {effectiveKind === "customFood" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
            <div className="space-y-2">
              <Label htmlFor="log-custom-name">Name</Label>
              <Input
                id="log-custom-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Café sandwich"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-custom-qty">× Qty</Label>
              <Input
                id="log-custom-qty"
                type="number"
                min={0.5}
                step={0.5}
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="log-custom-kcal">kcal</Label>
              <Input
                id="log-custom-kcal"
                type="number"
                step="any"
                value={customKcal}
                onChange={(e) => setCustomKcal(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-custom-p">Protein g</Label>
              <Input
                id="log-custom-p"
                type="number"
                step="any"
                value={customProtein}
                onChange={(e) => setCustomProtein(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-custom-c">Carbs g</Label>
              <Input
                id="log-custom-c"
                type="number"
                step="any"
                value={customCarbs}
                onChange={(e) => setCustomCarbs(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-custom-f">Fat g</Label>
              <Input
                id="log-custom-f"
                type="number"
                step="any"
                value={customFat}
                onChange={(e) => setCustomFat(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-custom-na">Sodium mg (optional)</Label>
              <Input
                id="log-custom-na"
                type="number"
                step="any"
                min={0}
                placeholder="Unknown"
                value={customSodium}
                onChange={(e) => setCustomSodium(e.target.value)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="log-note">Note (optional)</Label>
        <Input
          id="log-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {editing ? "Save changes" : "Log meal"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  deriveRecents,
  recipePerServing,
  unitsForKind,
  type Ingredient,
  type MealSlot,
  type PlanMealEntry,
  type Recipe,
  type Unit,
} from "@/domain";
import { useRepos } from "@/data";
import type { BatchListRow } from "@/features/cook/hooks";
import { useLoggedMeals } from "@/features/cook/hooks";
import {
  ENTRY_SOURCE_QUESTION,
  LEXICON,
  planEntryKindOptions,
} from "@/features/shared/entry-kind-copy";
import { InfoPopover } from "@/features/shared/InfoPopover";
import { appendPlannedMeal } from "@/features/plan/appendPlannedMeal";
import { usePlannedMeals } from "@/features/plan/hooks";
import { RecentsRail } from "@/features/plan/RecentsRail";
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

type EntryKind = PlanMealEntry["kind"];

export type AddPlannedMealFormProps = {
  date: string;
  slotId: string;
  slots: MealSlot[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  batchRows: BatchListRow[];
  onDone: () => void;
  onCancel: () => void;
};

export function AddPlannedMealForm({
  date: initialDate,
  slotId: initialSlotId,
  slots,
  recipes,
  ingredients,
  batchRows,
  onDone,
  onCancel,
}: AddPlannedMealFormProps) {
  const repos = useRepos();
  const plannedMeals = usePlannedMeals();
  const loggedMeals = useLoggedMeals();
  const availableBatches = useMemo(
    () => batchRows.filter((row) => row.available),
    [batchRows],
  );
  const hasAvailableBatches = availableBatches.length > 0;
  const kindOptions = useMemo(
    () => planEntryKindOptions(hasAvailableBatches),
    [hasAvailableBatches],
  );
  const ingredientsById = useMemo(() => {
    const map = new Map<string, Ingredient>();
    for (const ingredient of ingredients) map.set(ingredient.id, ingredient);
    return map;
  }, [ingredients]);
  const recipesById = useMemo(() => {
    const map = new Map<string, Recipe>();
    for (const recipe of recipes) map.set(recipe.id, recipe);
    return map;
  }, [recipes]);
  const batchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of batchRows) {
      map.set(row.batch.id, row.batch.label ?? row.batch.snapshot.recipeName);
    }
    return map;
  }, [batchRows]);

  const recents = useMemo(() => {
    if (!plannedMeals || !loggedMeals) return [];
    return deriveRecents(plannedMeals, loggedMeals);
  }, [plannedMeals, loggedMeals]);

  const [date, setDate] = useState(initialDate);
  const [slotId, setSlotId] = useState(initialSlotId);
  const [kind, setKind] = useState<EntryKind>("recipeServings");
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [servings, setServings] = useState("1");
  const [batchId, setBatchId] = useState(availableBatches[0]?.batch.id ?? "");
  const [portions, setPortions] = useState("1");
  const effectiveKind: EntryKind =
    kind === "batchPortions" && !hasAvailableBatches
      ? "recipeServings"
      : kind;
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? "");
  const selectedIngredient =
    ingredients.find((i) => i.id === ingredientId) ?? ingredients[0];
  const units = selectedIngredient
    ? unitsForKind(selectedIngredient.measureKind)
    : [];
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>(units[0] ?? "g");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [recipeRecents, setRecipeRecents] = useState(() =>
    readPickerRecents("recipes"),
  );
  const [batchRecents, setBatchRecents] = useState(() =>
    readPickerRecents("batches"),
  );
  const [ingredientRecents, setIngredientRecents] = useState(() =>
    readPickerRecents("ingredients"),
  );

  const onIngredientChange = (id: string) => {
    setIngredientId(id);
    setIngredientRecents(rememberPickerRecent("ingredients", id));
    const next = ingredients.find((i) => i.id === id);
    if (next) {
      const nextUnits = unitsForKind(next.measureKind);
      setUnit(nextUnits[0] ?? "g");
    }
  };

  const putPlanned = async (entry: PlanMealEntry, entryNote: string | null) => {
    if (!repos) {
      toast.error("Data is not ready yet");
      return false;
    }
    await appendPlannedMeal(repos, {
      date,
      slotId,
      entry,
      note: entryNote,
    });
    return true;
  };

  const onRecentTap = async (entry: PlanMealEntry) => {
    if (busy) return;
    if (entry.kind === "batchPortions") {
      const stillAvailable = availableBatches.some(
        (row) => row.batch.id === entry.batchId,
      );
      if (!stillAvailable) {
        toast.error("That batch no longer has portions left");
        return;
      }
    }
    setBusy(true);
    try {
      const ok = await putPlanned(entry, null);
      if (!ok) return;
      if (entry.kind === "recipeServings") {
        setRecipeRecents(rememberPickerRecent("recipes", entry.recipeId));
      } else if (entry.kind === "batchPortions") {
        setBatchRecents(rememberPickerRecent("batches", entry.batchId));
      } else {
        setIngredientRecents(
          rememberPickerRecent("ingredients", entry.ingredientId),
        );
      }
      toast.success("Meal planned");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save planned meal",
      );
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!repos) {
      toast.error("Data is not ready yet");
      return;
    }

    let entry: PlanMealEntry;
    if (effectiveKind === "recipeServings") {
      const servingsNum = Number(servings);
      if (!recipeId || !Number.isFinite(servingsNum) || servingsNum <= 0) {
        toast.error("Pick a recipe and a positive servings amount");
        return;
      }
      entry = { kind: "recipeServings", recipeId, servings: servingsNum };
      setRecipeRecents(rememberPickerRecent("recipes", recipeId));
    } else if (effectiveKind === "batchPortions") {
      const portionsNum = Number(portions);
      if (!batchId || !Number.isFinite(portionsNum) || portionsNum <= 0) {
        toast.error("Pick a batch and a positive portion amount");
        return;
      }
      entry = { kind: "batchPortions", batchId, portions: portionsNum };
      setBatchRecents(rememberPickerRecent("batches", batchId));
    } else {
      const value = Number(amount);
      if (!selectedIngredient || !Number.isFinite(value) || value < 0) {
        toast.error("Pick an ingredient and a non-negative amount");
        return;
      }
      entry = {
        kind: "ingredient",
        ingredientId: selectedIngredient.id,
        quantity: { value, unit },
      };
      setIngredientRecents(
        rememberPickerRecent("ingredients", selectedIngredient.id),
      );
    }

    setBusy(true);
    try {
      const ok = await putPlanned(entry, note.trim() ? note.trim() : null);
      if (!ok) return;
      toast.success("Meal planned");
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save planned meal",
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
      <RecentsRail
        recents={recents}
        recipesById={recipesById}
        ingredientsById={ingredientsById}
        batchNameById={batchNameById}
        disabled={busy}
        onSelect={(entry) => void onRecentTap(entry)}
        labelId="plan-recents-label"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plan-date">Date</Label>
          <Input
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label id="plan-slot-label">Slot</Label>
          <SegmentedGroup
            id="plan-slot"
            aria-labelledby="plan-slot-label"
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
          <Label id="plan-kind-label">{ENTRY_SOURCE_QUESTION}</Label>
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
          id="plan-kind"
          aria-labelledby="plan-kind-label"
          value={effectiveKind}
          onValueChange={(next) => setKind(next as EntryKind)}
          options={kindOptions}
        />
      </div>

      {effectiveKind === "recipeServings" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-2">
            <Label id="plan-recipe-label">Recipe</Label>
            {recipes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recipes yet</p>
            ) : (
              <CommandPicker
                id="plan-recipe"
                aria-labelledby="plan-recipe-label"
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
            <Label htmlFor="plan-servings">Servings</Label>
            <Input
              id="plan-servings"
              inputMode="decimal"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {effectiveKind === "batchPortions" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-2">
            <Label id="plan-batch-label">Batch</Label>
            {!hasAvailableBatches ? (
              <p className="text-sm text-muted-foreground">
                No batches yet. Cook a recipe and its portions appear here.
              </p>
            ) : (
              <CommandPicker
                id="plan-batch"
                aria-labelledby="plan-batch-label"
                title="Choose batch"
                value={batchId}
                onValueChange={(id) => {
                  setBatchId(id);
                  setBatchRecents(rememberPickerRecent("batches", id));
                }}
                recentIds={batchRecents}
                items={availableBatches.map((row) => ({
                  value: row.batch.id,
                  label:
                    row.batch.label ?? row.batch.snapshot.recipeName,
                  context: `${row.remaining} left · cooked ${row.batch.cookedAt.slice(0, 10)}`,
                }))}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-portions">Portions</Label>
            <Input
              id="plan-portions"
              inputMode="decimal"
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {effectiveKind === "ingredient" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_6rem_minmax(0,8rem)]">
          <div className="space-y-2">
            <Label id="plan-ingredient-label">Ingredient</Label>
            {ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ingredients yet</p>
            ) : (
              <IngredientPicker
                id="plan-ingredient"
                aria-labelledby="plan-ingredient-label"
                title="Choose ingredient"
                value={ingredientId}
                onValueChange={onIngredientChange}
                recentIds={ingredientRecents}
                ingredients={ingredients}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-amount">Amount</Label>
            <Input
              id="plan-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label id="plan-unit-label">Unit</Label>
            <UnitChoice
              id="plan-unit"
              aria-labelledby="plan-unit-label"
              units={units}
              value={unit}
              onValueChange={setUnit}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="plan-note">Note (optional)</Label>
        <Input
          id="plan-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add to plan"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

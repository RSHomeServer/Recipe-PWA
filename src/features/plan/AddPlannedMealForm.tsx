import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createId,
  unitsForKind,
  type Ingredient,
  type MealSlot,
  type PlanMealEntry,
  type Recipe,
  type Unit,
} from "@/domain";
import { useRepos } from "@/data";
import type { BatchListRow } from "@/features/cook/hooks";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { NativeSelect } from "@/ui/native-select";

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
  const availableBatches = useMemo(
    () => batchRows.filter((row) => row.available),
    [batchRows],
  );

  const [date, setDate] = useState(initialDate);
  const [slotId, setSlotId] = useState(initialSlotId);
  const [kind, setKind] = useState<EntryKind>("recipeServings");
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [servings, setServings] = useState("1");
  const [batchId, setBatchId] = useState(availableBatches[0]?.batch.id ?? "");
  const [portions, setPortions] = useState("1");
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

  const onIngredientChange = (id: string) => {
    setIngredientId(id);
    const next = ingredients.find((i) => i.id === id);
    if (next) {
      const nextUnits = unitsForKind(next.measureKind);
      setUnit(nextUnits[0] ?? "g");
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!repos) {
      toast.error("Data is not ready yet");
      return;
    }

    let entry: PlanMealEntry;
    if (kind === "recipeServings") {
      const servingsNum = Number(servings);
      if (!recipeId || !Number.isFinite(servingsNum) || servingsNum <= 0) {
        toast.error("Pick a recipe and a positive servings amount");
        return;
      }
      entry = { kind, recipeId, servings: servingsNum };
    } else if (kind === "batchPortions") {
      const portionsNum = Number(portions);
      if (!batchId || !Number.isFinite(portionsNum) || portionsNum <= 0) {
        toast.error("Pick a batch and a positive portion amount");
        return;
      }
      entry = { kind, batchId, portions: portionsNum };
    } else {
      const value = Number(amount);
      if (
        !selectedIngredient ||
        !Number.isFinite(value) ||
        value < 0
      ) {
        toast.error("Pick an ingredient and a non-negative amount");
        return;
      }
      entry = {
        kind: "ingredient",
        ingredientId: selectedIngredient.id,
        quantity: { value, unit },
      };
    }

    setBusy(true);
    try {
      const existing = (await repos.plannedMeals.all()).filter(
        (m) => m.date === date && m.slotId === slotId,
      );
      const position =
        existing.reduce((max, m) => Math.max(max, m.position), -1) + 1;
      await repos.plannedMeals.put({
        id: createId(),
        date,
        slotId,
        entry,
        position,
        note: note.trim() ? note.trim() : null,
      });
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
          <Label htmlFor="plan-slot">Slot</Label>
          <NativeSelect
            id="plan-slot"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
          >
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-kind">What to plan</Label>
        <NativeSelect
          id="plan-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as EntryKind)}
        >
          <option value="recipeServings">Recipe to cook</option>
          <option value="batchPortions">Batch portion</option>
          <option value="ingredient">Ingredient</option>
        </NativeSelect>
      </div>

      {kind === "recipeServings" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-2">
            <Label htmlFor="plan-recipe">Recipe</Label>
            <NativeSelect
              id="plan-recipe"
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              disabled={recipes.length === 0}
            >
              {recipes.length === 0 ? (
                <option value="">No recipes yet</option>
              ) : (
                recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </option>
                ))
              )}
            </NativeSelect>
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

      {kind === "batchPortions" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-2">
            <Label htmlFor="plan-batch">Batch</Label>
            <NativeSelect
              id="plan-batch"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={availableBatches.length === 0}
            >
              {availableBatches.length === 0 ? (
                <option value="">No available batches</option>
              ) : (
                availableBatches.map((row) => (
                  <option key={row.batch.id} value={row.batch.id}>
                    {row.batch.snapshot.recipeName} ({row.remaining} left)
                  </option>
                ))
              )}
            </NativeSelect>
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

      {kind === "ingredient" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_6rem_6rem]">
          <div className="space-y-2">
            <Label htmlFor="plan-ingredient">Ingredient</Label>
            <NativeSelect
              id="plan-ingredient"
              value={ingredientId}
              onChange={(e) => onIngredientChange(e.target.value)}
              disabled={ingredients.length === 0}
            >
              {ingredients.length === 0 ? (
                <option value="">No ingredients yet</option>
              ) : (
                ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))
              )}
            </NativeSelect>
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
            <Label htmlFor="plan-unit">Unit</Label>
            <NativeSelect
              id="plan-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </NativeSelect>
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

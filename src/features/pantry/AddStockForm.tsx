import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  applyStockMutation,
  unitsForKind,
  type Ingredient,
  type PantryStock,
  type Unit,
} from "@/domain";
import { useRepos } from "@/data";
import { IngredientPicker } from "@/features/ingredients/IngredientPicker";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  readPickerRecents,
  rememberPickerRecent,
} from "@/ui/picker-recents";
import { UnitChoice } from "@/ui/unit-choice";

export type AddStockFormProps = {
  candidates: Ingredient[];
  stockById: ReadonlyMap<string, PantryStock>;
  onDone?: () => void;
};

export function AddStockForm({
  candidates,
  stockById,
  onDone,
}: AddStockFormProps) {
  const repos = useRepos();
  const [ingredientId, setIngredientId] = useState(candidates[0]?.id ?? "");
  const [recents, setRecents] = useState(() =>
    readPickerRecents("ingredients"),
  );
  const selected =
    candidates.find((row) => row.id === ingredientId) ?? candidates[0];
  const units = selected ? unitsForKind(selected.measureKind) : [];
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>(units[0] ?? "g");
  const [busy, setBusy] = useState(false);

  const onIngredientChange = (id: string) => {
    setIngredientId(id);
    setRecents(rememberPickerRecent("ingredients", id));
    const next = candidates.find((row) => row.id === id);
    if (next) {
      const nextUnits = unitsForKind(next.measureKind);
      setUnit(nextUnits[0] ?? "g");
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!repos || !selected) {
      toast.error("Pick an ingredient first");
      return;
    }
    const value = Number(amount.trim());
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a non-negative amount");
      return;
    }

    setBusy(true);
    try {
      const existing = stockById.get(selected.id);
      const result = applyStockMutation(
        existing,
        selected,
        existing
          ? { op: "add", quantity: { value, unit } }
          : { op: "set", quantity: { value, unit } },
        new Date().toISOString(),
      );
      if (!result.ok) {
        toast.error(
          `Use a ${result.expected} unit (${result.allowed.join(", ")})`,
        );
        return;
      }
      await repos.pantryStock.put(result.stock);
      toast.success(`Updated ${selected.name}`);
      setAmount("");
      onDone?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add stock",
      );
    } finally {
      setBusy(false);
    }
  };

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every active ingredient already has a pantry row. Adjust quantities in
        the list, or add more ingredients first.
      </p>
    );
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_6rem_minmax(0,8rem)_auto]"
      onSubmit={(event) => void onSubmit(event)}
    >
      <div className="space-y-2">
        <Label id="add-stock-ingredient-label">Ingredient</Label>
        <IngredientPicker
          id="add-stock-ingredient"
          aria-labelledby="add-stock-ingredient-label"
          title="Choose ingredient"
          value={selected?.id ?? ""}
          onValueChange={onIngredientChange}
          recentIds={recents}
          ingredients={candidates}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="add-stock-amount">Amount</Label>
        <Input
          id="add-stock-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label id="add-stock-unit-label">Unit</Label>
        <UnitChoice
          id="add-stock-unit"
          aria-labelledby="add-stock-unit-label"
          units={units}
          value={unit}
          onValueChange={setUnit}
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={busy || !selected}>
          Add stock
        </Button>
      </div>
    </form>
  );
}

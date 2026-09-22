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
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { NativeSelect } from "@/ui/native-select";

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
  const selected =
    candidates.find((row) => row.id === ingredientId) ?? candidates[0];
  const units = selected ? unitsForKind(selected.measureKind) : [];
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>(units[0] ?? "g");
  const [busy, setBusy] = useState(false);

  const onIngredientChange = (id: string) => {
    setIngredientId(id);
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
      className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_6rem_6rem_auto]"
      onSubmit={(event) => void onSubmit(event)}
    >
      <div className="space-y-2">
        <Label htmlFor="add-stock-ingredient">Ingredient</Label>
        <NativeSelect
          id="add-stock-ingredient"
          value={selected?.id ?? ""}
          onChange={(event) => onIngredientChange(event.target.value)}
        >
          {candidates.map((ingredient) => (
            <option key={ingredient.id} value={ingredient.id}>
              {ingredient.name}
            </option>
          ))}
        </NativeSelect>
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
        <Label htmlFor="add-stock-unit">Unit</Label>
        <NativeSelect
          id="add-stock-unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value as Unit)}
        >
          {units.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={busy || !selected}>
          Add stock
        </Button>
      </div>
    </form>
  );
}

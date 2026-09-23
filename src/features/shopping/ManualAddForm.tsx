import { useState, type FormEvent } from "react";
import {
  unitsForKind,
  type Ingredient,
  type Quantity,
  type Unit,
} from "@/domain";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { NativeSelect } from "@/ui/native-select";

export type ManualAddFormProps = {
  ingredients: Ingredient[];
  onAdd: (ingredientId: string, quantity: Quantity) => void;
  onCancel: () => void;
};

export function ManualAddForm({
  ingredients,
  onAdd,
  onCancel,
}: ManualAddFormProps) {
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? "");
  const selected =
    ingredients.find((i) => i.id === ingredientId) ?? ingredients[0];
  const units = selected ? unitsForKind(selected.measureKind) : [];
  const [value, setValue] = useState("1");
  const [unit, setUnit] = useState<Unit>(units[0] ?? "g");

  const onIngredientChange = (id: string) => {
    setIngredientId(id);
    const next = ingredients.find((row) => row.id === id);
    if (next) {
      const nextUnits = unitsForKind(next.measureKind);
      setUnit(nextUnits[0] ?? "g");
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onAdd(selected.id, { value: amount, unit });
  };

  return (
    <form
      className="space-y-4 rounded-lg border border-border bg-[var(--color-surface-raised)] p-4"
      onSubmit={onSubmit}
    >
      <p className="font-medium">Add something to buy</p>
      <div className="space-y-1">
        <Label htmlFor="manual-ingredient">Ingredient</Label>
        <NativeSelect
          id="manual-ingredient"
          value={ingredientId}
          onChange={(e) => onIngredientChange(e.target.value)}
        >
          {ingredients.map((ingredient) => (
            <option key={ingredient.id} value={ingredient.id}>
              {ingredient.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label htmlFor="manual-qty">Quantity</Label>
          <Input
            id="manual-qty"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="manual-unit">Unit</Label>
          <NativeSelect
            id="manual-unit"
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Add to list</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

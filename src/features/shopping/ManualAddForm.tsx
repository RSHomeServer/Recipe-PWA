import { useState, type FormEvent } from "react";
import {
  unitsForKind,
  type Ingredient,
  type Quantity,
  type Unit,
} from "@/domain";
import { Button } from "@/ui/button";
import { CommandPicker } from "@/ui/command-picker";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  readPickerRecents,
  rememberPickerRecent,
} from "@/ui/picker-recents";
import { UnitChoice } from "@/ui/unit-choice";

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
  const [recents, setRecents] = useState(() =>
    readPickerRecents("ingredients"),
  );
  const selected =
    ingredients.find((i) => i.id === ingredientId) ?? ingredients[0];
  const units = selected ? unitsForKind(selected.measureKind) : [];
  const [value, setValue] = useState("1");
  const [unit, setUnit] = useState<Unit>(units[0] ?? "g");

  const onIngredientChange = (id: string) => {
    setIngredientId(id);
    setRecents(rememberPickerRecent("ingredients", id));
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
        <Label id="manual-ingredient-label">Ingredient</Label>
        <CommandPicker
          id="manual-ingredient"
          aria-labelledby="manual-ingredient-label"
          title="Choose ingredient"
          value={ingredientId}
          onValueChange={onIngredientChange}
          recentIds={recents}
          items={ingredients.map((ingredient) => ({
            value: ingredient.id,
            label: ingredient.name,
            context: ingredient.measureKind,
          }))}
        />
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
          <Label id="manual-unit-label">Unit</Label>
          <UnitChoice
            id="manual-unit"
            aria-labelledby="manual-unit-label"
            units={units}
            value={unit}
            onValueChange={setUnit}
          />
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

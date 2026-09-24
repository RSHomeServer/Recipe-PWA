import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createId,
  unitsForKind,
  type Ingredient,
  type MealSlot,
  type MealTemplate,
  type MealTemplateComponent,
  type MealTemplateEntry,
  type Recipe,
  type Unit,
} from "@/domain";
import { IngredientPicker } from "@/features/ingredients/IngredientPicker";
import { Button } from "@/ui/button";
import { CommandPicker } from "@/ui/command-picker";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  readPickerRecents,
  rememberPickerRecent,
} from "@/ui/picker-recents";
import { SegmentedGroup } from "@/ui/segmented-group";
import { UnitChoice } from "@/ui/unit-choice";

type DraftComponent = {
  key: string;
  kind: "recipeServings" | "ingredient";
  recipeId: string;
  servings: string;
  ingredientId: string;
  amount: string;
  unit: Unit;
  note: string;
};

function draftFromComponent(
  component: MealTemplateComponent,
  ingredients: Ingredient[],
): DraftComponent {
  if (component.entry.kind === "recipeServings") {
    return {
      key: component.id,
      kind: "recipeServings",
      recipeId: component.entry.recipeId,
      servings: String(component.entry.servings),
      ingredientId: ingredients[0]?.id ?? "",
      amount: "",
      unit: "g",
      note: component.note ?? "",
    };
  }
  const entry = component.entry;
  const ingredient =
    ingredients.find((i) => i.id === entry.ingredientId) ?? ingredients[0];
  const units = ingredient ? unitsForKind(ingredient.measureKind) : (["g"] as Unit[]);
  return {
    key: component.id,
    kind: "ingredient",
    recipeId: "",
    servings: "1",
    ingredientId: entry.ingredientId,
    amount: String(entry.quantity.value),
    unit: units.includes(entry.quantity.unit)
      ? entry.quantity.unit
      : (units[0] ?? "g"),
    note: component.note ?? "",
  };
}

function emptyDraft(
  recipes: Recipe[],
  ingredients: Ingredient[],
): DraftComponent {
  const ingredient = ingredients[0];
  const units = ingredient ? unitsForKind(ingredient.measureKind) : (["g"] as Unit[]);
  return {
    key: createId(),
    kind: "recipeServings",
    recipeId: recipes[0]?.id ?? "",
    servings: "1",
    ingredientId: ingredient?.id ?? "",
    amount: "",
    unit: units[0] ?? "g",
    note: "",
  };
}

function toEntry(draft: DraftComponent): MealTemplateEntry | null {
  if (draft.kind === "recipeServings") {
    const servings = Number(draft.servings);
    if (!draft.recipeId || !Number.isFinite(servings) || servings <= 0) {
      return null;
    }
    return {
      kind: "recipeServings",
      recipeId: draft.recipeId,
      servings,
    };
  }
  const value = Number(draft.amount);
  if (!draft.ingredientId || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return {
    kind: "ingredient",
    ingredientId: draft.ingredientId,
    quantity: { value, unit: draft.unit },
  };
}

export type MealTemplateFormProps = {
  recipes: Recipe[];
  ingredients: Ingredient[];
  slots: MealSlot[];
  initial?: MealTemplate;
  submitting?: boolean;
  onSubmit: (template: MealTemplate) => Promise<void>;
  onArchive?: () => Promise<void>;
  onRestore?: () => Promise<void>;
  onCancel: () => void;
};

export function MealTemplateForm({
  recipes,
  ingredients,
  slots,
  initial,
  submitting = false,
  onSubmit,
  onArchive,
  onRestore,
  onCancel,
}: MealTemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [defaultSlotId, setDefaultSlotId] = useState(
    initial?.defaultSlotId ??
      slots.find((s) => s.isDefault)?.id ??
      slots[0]?.id ??
      "__ask__",
  );
  const [components, setComponents] = useState<DraftComponent[]>(() =>
    initial?.components.length
      ? initial.components.map((c) => draftFromComponent(c, ingredients))
      : [emptyDraft(recipes, ingredients)],
  );
  const [recipeRecents, setRecipeRecents] = useState(() =>
    readPickerRecents("recipes"),
  );
  const [ingredientRecents, setIngredientRecents] = useState(() =>
    readPickerRecents("ingredients"),
  );

  const recipeItems = useMemo(
    () =>
      recipes.map((r) => ({
        value: r.id,
        label: r.name,
        keywords: [r.name],
      })),
    [recipes],
  );

  const slotOptions = useMemo(
    () => [
      { value: "__ask__", label: "Ask each time" },
      ...slots.map((s) => ({ value: s.id, label: s.name })),
    ],
    [slots],
  );

  const updateDraft = (key: string, patch: Partial<DraftComponent>) => {
    setComponents((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give this meal a name");
      return;
    }
    if (components.length === 0) {
      toast.error("Add at least one component");
      return;
    }
    const built: MealTemplateComponent[] = [];
    for (const draft of components) {
      const entry = toEntry(draft);
      if (!entry) {
        toast.error("Each component needs a valid recipe or ingredient amount");
        return;
      }
      built.push({
        id: draft.key,
        entry,
        note: draft.note.trim() ? draft.note.trim() : null,
      });
      if (entry.kind === "recipeServings") {
        setRecipeRecents(rememberPickerRecent("recipes", entry.recipeId));
      } else {
        setIngredientRecents(
          rememberPickerRecent("ingredients", entry.ingredientId),
        );
      }
    }

    const now = new Date().toISOString();
    const template: MealTemplate = {
      id: initial?.id ?? createId(),
      name: trimmed,
      components: built,
      defaultSlotId:
        !defaultSlotId || defaultSlotId === "__ask__" ? null : defaultSlotId,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      archivedAt: initial?.archivedAt ?? null,
    };
    await onSubmit(template);
  };

  return (
    <form className="space-y-6" onSubmit={(e) => void handleSubmit(e)}>
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Changes apply to meals you plan from now on. Plans already made keep the
        food and group name they had when you applied this meal.
      </p>

      <div className="space-y-2">
        <Label htmlFor="meal-name">Name</Label>
        <Input
          id="meal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wings, hashbrowns & veg"
          required
        />
      </div>

      <div className="space-y-2">
        <Label id="meal-default-slot-label">Default slot</Label>
        <SegmentedGroup
          id="meal-default-slot"
          aria-labelledby="meal-default-slot-label"
          value={defaultSlotId}
          onValueChange={setDefaultSlotId}
          options={slotOptions}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-medium">Components</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setComponents((rows) => [
                ...rows,
                emptyDraft(recipes, ingredients),
              ])
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </div>

        <ul className="space-y-4">
          {components.map((draft, index) => {
            const ingredient =
              ingredients.find((i) => i.id === draft.ingredientId) ??
              ingredients[0];
            const units = ingredient
              ? unitsForKind(ingredient.measureKind)
              : (["g"] as Unit[]);
            return (
              <li
                key={draft.key}
                className="space-y-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Component {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove component ${index + 1}`}
                    disabled={components.length <= 1}
                    onClick={() =>
                      setComponents((rows) =>
                        rows.filter((r) => r.key !== draft.key),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <SegmentedGroup
                  id={`meal-kind-${draft.key}`}
                  aria-label={`Component ${index + 1} type`}
                  value={draft.kind}
                  onValueChange={(value) =>
                    updateDraft(draft.key, {
                      kind: value as DraftComponent["kind"],
                    })
                  }
                  options={[
                    { value: "recipeServings", label: "Recipe" },
                    { value: "ingredient", label: "Ingredient" },
                  ]}
                />

                {draft.kind === "recipeServings" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Recipe</Label>
                      <CommandPicker
                        value={draft.recipeId}
                        onValueChange={(id) =>
                          updateDraft(draft.key, { recipeId: id })
                        }
                        items={recipeItems}
                        recentIds={recipeRecents}
                        placeholder="Pick a recipe"
                        emptyText="No recipes match"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`servings-${draft.key}`}>Servings</Label>
                      <Input
                        id={`servings-${draft.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0.1}
                        step="any"
                        value={draft.servings}
                        onChange={(e) =>
                          updateDraft(draft.key, { servings: e.target.value })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Ingredient</Label>
                      <IngredientPicker
                        ingredients={ingredients}
                        value={draft.ingredientId}
                        recentIds={ingredientRecents}
                        onValueChange={(id) => {
                          const next = ingredients.find((i) => i.id === id);
                          const nextUnits = next
                            ? unitsForKind(next.measureKind)
                            : (["g"] as Unit[]);
                          updateDraft(draft.key, {
                            ingredientId: id,
                            unit: nextUnits[0] ?? "g",
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`amount-${draft.key}`}>Amount</Label>
                      <Input
                        id={`amount-${draft.key}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={draft.amount}
                        onChange={(e) =>
                          updateDraft(draft.key, { amount: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Unit</Label>
                      <UnitChoice
                        value={draft.unit}
                        units={units}
                        onValueChange={(unit) =>
                          updateDraft(draft.key, { unit })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`note-${draft.key}`}>Note (optional)</Label>
                  <Input
                    id={`note-${draft.key}`}
                    value={draft.note}
                    onChange={(e) =>
                      updateDraft(draft.key, { note: e.target.value })
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>
          {initial ? "Save meal" : "Create meal"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {initial && initial.archivedAt == null && onArchive ? (
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--color-error)]"
            onClick={() => void onArchive()}
          >
            Archive
          </Button>
        ) : null}
        {initial && initial.archivedAt != null && onRestore ? (
          <Button type="button" variant="ghost" onClick={() => void onRestore()}>
            Restore
          </Button>
        ) : null}
      </div>
    </form>
  );
}

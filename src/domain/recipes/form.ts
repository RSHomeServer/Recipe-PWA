import { z } from "zod";
import { fromCanonical, unitsForKind } from "../units";
import type { Ingredient } from "../ingredients/schemas";
import type { CanonicalQuantity, MeasureKind, Unit } from "../units/schemas";
import { createId, IdSchema } from "../shared/primitives";
import type { Recipe, RecipeLine } from "./schemas";
import {
  EntryMeasureSchema,
  entryToCanonical,
  isSpoonKind,
  type EntryMeasure,
} from "../spoons";

/** RHF draft line — amount + entry measure (units or cited spoons). */
export const RecipeLineDraftSchema = z.object({
  id: IdSchema,
  ingredientId: IdSchema,
  amount: z.number().finite().nonnegative("Quantity must be zero or more"),
  entryMeasure: EntryMeasureSchema,
  optional: z.boolean(),
  note: z.string(),
});
export type RecipeLineDraft = z.infer<typeof RecipeLineDraftSchema>;

export const RecipeFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  servings: z
    .number({ invalid_type_error: "Servings is required" })
    .finite()
    .positive("Servings must be greater than 0"),
  lines: z.array(RecipeLineDraftSchema),
  steps: z.array(z.string()),
  /** Comma-separated in the form; parsed to string[] on submit. */
  tagsText: z.string(),
  notes: z.string(),
});
export type RecipeFormValues = z.input<typeof RecipeFormSchema>;
export type RecipeFormParsed = z.output<typeof RecipeFormSchema>;

export function parseTagsText(tagsText: string): string[] {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export type RecipeLineBuildError = {
  lineId: string;
  message: string;
};

export type BuiltRecipeFields = {
  name: string;
  servings: number;
  lines: RecipeLine[];
  steps: string[];
  tags: string[];
  notes: string | null;
};

/**
 * Convert draft lines to stored `RecipeLine`s. Spoons convert once at the
 * boundary into grams; entryHint is display-only (ADR-008).
 */
export function buildRecipeFields(
  values: RecipeFormParsed,
  ingredientsById: ReadonlyMap<string, Ingredient>,
):
  | { ok: true; fields: BuiltRecipeFields }
  | { ok: false; errors: RecipeLineBuildError[] } {
  const errors: RecipeLineBuildError[] = [];
  const byIngredient = new Map<
    string,
    {
      id: string;
      ingredientId: string;
      quantity: CanonicalQuantity;
      displayUnit: Unit;
      optional: boolean;
      note: string | null;
      entryHint: RecipeLine["entryHint"];
    }
  >();

  for (const draft of values.lines) {
    const ingredient = ingredientsById.get(draft.ingredientId);
    if (!ingredient) {
      errors.push({
        lineId: draft.id,
        message: "Ingredient is missing from the library",
      });
      continue;
    }
    if (ingredient.archivedAt != null) {
      errors.push({
        lineId: draft.id,
        message: `${ingredient.name} is archived — restore it or remove this line`,
      });
      continue;
    }

    const converted = entryToCanonical(
      draft.amount,
      draft.entryMeasure,
      ingredient,
    );
    if (!converted.ok) {
      errors.push({ lineId: draft.id, message: converted.message });
      continue;
    }

    const note = draft.note.trim().length === 0 ? null : draft.note.trim();
    const existing = byIngredient.get(draft.ingredientId);
    if (existing) {
      existing.quantity = {
        amount: existing.quantity.amount + converted.canonical.amount,
        kind: existing.quantity.kind,
      };
      existing.optional = existing.optional && draft.optional;
      if (note) {
        existing.note = existing.note ? `${existing.note}; ${note}` : note;
      }
      existing.entryHint = null;
      continue;
    }

    byIngredient.set(draft.ingredientId, {
      id: draft.id,
      ingredientId: draft.ingredientId,
      quantity: converted.canonical,
      displayUnit: converted.displayUnit,
      optional: draft.optional,
      note,
      entryHint: converted.entryHint,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const steps = values.steps
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
  const tags = parseTagsText(values.tagsText);

  return {
    ok: true,
    fields: {
      name: values.name,
      servings: values.servings,
      lines: [...byIngredient.values()].map((line) => ({
        ...line,
        entryHint: line.entryHint ?? null,
      })),
      steps,
      tags,
      notes: (() => {
        const trimmed = values.notes.trim();
        return trimmed.length === 0 ? null : trimmed;
      })(),
    },
  };
}

/** Merge a new draft onto an existing line for the same ingredient. */
export function mergeLineDrafts(
  existing: RecipeLineDraft,
  incoming: RecipeLineDraft,
  measureKind: MeasureKind,
  ingredient?: Ingredient,
): RecipeLineDraft {
  if (ingredient) {
    const a = entryToCanonical(existing.amount, existing.entryMeasure, ingredient);
    const b = entryToCanonical(incoming.amount, incoming.entryMeasure, ingredient);
    if (a.ok && b.ok) {
      const summed: CanonicalQuantity = {
        amount: a.canonical.amount + b.canonical.amount,
        kind: measureKind,
      };
      const keepMeasure: EntryMeasure = isSpoonKind(existing.entryMeasure)
        ? "g"
        : existing.entryMeasure;
      const display = fromCanonical(summed, keepMeasure);
      return {
        ...existing,
        amount: display.ok ? display.quantity.value : summed.amount,
        entryMeasure: keepMeasure,
        optional: existing.optional && incoming.optional,
        note: [existing.note, incoming.note]
          .map((n) => n.trim())
          .filter(Boolean)
          .join("; "),
      };
    }
  }

  return {
    ...existing,
    amount: existing.amount + incoming.amount,
    optional: existing.optional && incoming.optional,
    note: [existing.note, incoming.note]
      .map((n) => n.trim())
      .filter(Boolean)
      .join("; "),
  };
}

export function draftFromRecipeLine(line: RecipeLine): RecipeLineDraft {
  if (line.entryHint != null) {
    return {
      id: line.id,
      ingredientId: line.ingredientId,
      amount: line.entryHint.spoons,
      entryMeasure: line.entryHint.spoon,
      optional: line.optional,
      note: line.note ?? "",
    };
  }
  const display = fromCanonical(line.quantity, line.displayUnit);
  return {
    id: line.id,
    ingredientId: line.ingredientId,
    amount: display.ok ? display.quantity.value : line.quantity.amount,
    entryMeasure: line.displayUnit,
    optional: line.optional,
    note: line.note ?? "",
  };
}

export function emptyRecipeFormValues(): RecipeFormValues {
  return {
    name: "",
    servings: 1,
    lines: [],
    steps: [""],
    tagsText: "",
    notes: "",
  };
}

export function recipeToFormValues(recipe: Recipe): RecipeFormValues {
  return {
    name: recipe.name,
    servings: recipe.servings,
    lines: recipe.lines.map(draftFromRecipeLine),
    steps: recipe.steps.length > 0 ? [...recipe.steps] : [""],
    tagsText: recipe.tags.join(", "),
    notes: recipe.notes ?? "",
  };
}

export function defaultUnitForKind(kind: MeasureKind): Unit {
  return unitsForKind(kind)[0] ?? "g";
}

export function newLineDraft(
  ingredientId: string,
  measureKind: MeasureKind,
): RecipeLineDraft {
  return {
    id: createId(),
    ingredientId,
    amount: 0,
    entryMeasure: defaultUnitForKind(measureKind),
    optional: false,
    note: "",
  };
}

/** Map draft lines into the shape `recipeTotal` / breakdown expect (live preview). */
export function draftsToRecipeInput(
  name: string,
  servings: number,
  lines: RecipeLineDraft[],
  ingredientsById: ReadonlyMap<string, Ingredient>,
): {
  id: string;
  name: string;
  servings: number;
  lines: RecipeLine[];
} | null {
  const built = buildRecipeFields(
    {
      name: name.trim() || "Draft",
      servings: servings > 0 ? servings : 1,
      lines,
      steps: [],
      tagsText: "",
      notes: "",
    },
    ingredientsById,
  );
  if (!built.ok) return null;
  return {
    id: "00000000-0000-4000-8000-000000000000",
    name: built.fields.name,
    servings: built.fields.servings,
    lines: built.fields.lines,
  };
}

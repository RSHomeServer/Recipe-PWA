import { z } from "zod";
import { NutritionSchema } from "../nutrition/schemas";
import { MeasureKindSchema } from "../units/schemas";
import { IdSchema } from "../shared/primitives";
import { IngredientSchema } from "./schemas";

/** RHF draft: id / archivedAt assigned on save; empty notes → null. */
export const IngredientFormSchema = IngredientSchema.omit({
  id: true,
  archivedAt: true,
}).extend({
  name: z.string().trim().min(1, "Name is required"),
  categoryId: IdSchema.nullable(),
  measureKind: MeasureKindSchema,
  nutrition: NutritionSchema,
  notes: z.string().transform((value) => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }),
});

export type IngredientFormValues = z.input<typeof IngredientFormSchema>;
export type IngredientFormParsed = z.output<typeof IngredientFormSchema>;

export function nutritionBasisLabel(
  kind: z.infer<typeof MeasureKindSchema>,
): string {
  switch (kind) {
    case "mass":
      return "per 100 g";
    case "volume":
      return "per 100 ml";
    case "count":
      return "per 1 item";
  }
}

export function emptyIngredientFormValues(): IngredientFormValues {
  return {
    name: "",
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    notes: "",
  };
}

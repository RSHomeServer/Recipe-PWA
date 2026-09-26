import { z } from "zod";
import { NutritionSchema } from "../nutrition/schemas";
import { MeasureKindSchema } from "../units/schemas";
import { IdSchema } from "../shared/primitives";
import { IngredientSchema } from "./schemas";

/** RHF draft: id / archivedAt / provenance / V3 metadata assigned on save. */
export const IngredientFormSchema = IngredientSchema.omit({
  id: true,
  archivedAt: true,
  source: true,
  imageId: true,
  common: true,
  gramsPerTsp: true,
  gramsPerTbsp: true,
  flavourTags: true,
}).extend({
  name: z.string().trim().min(1, "Name is required"),
  categoryId: IdSchema.nullable(),
  measureKind: MeasureKindSchema,
  nutrition: NutritionSchema.extend({
    sodiumMg: z.preprocess((value) => {
      if (value === "" || value === undefined || value === null) return null;
      if (typeof value === "number" && Number.isNaN(value)) return null;
      return value;
    }, z.number().finite().nonnegative().nullable()),
  }),
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
    nutrition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: null },
    notes: "",
  };
}

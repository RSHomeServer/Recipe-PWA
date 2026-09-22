import { z } from "zod";
import { CanonicalQuantitySchema } from "../units/schemas";
import { IdSchema, IsoDateTimeSchema } from "../shared/primitives";

export const PantryStockSchema = z.object({
  ingredientId: IdSchema,
  quantity: CanonicalQuantitySchema,
  updatedAt: IsoDateTimeSchema,
});
export type PantryStock = z.infer<typeof PantryStockSchema>;

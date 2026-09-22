import { z } from "zod";
import { CanonicalQuantitySchema } from "../units/schemas";
import { IdSchema } from "../shared/primitives";

export const ShoppingOverlaySchema = z.object({
  id: IdSchema,
  windowKey: z.string().min(1),
  checked: z.array(IdSchema),
  suppressed: z.array(IdSchema),
  adjustments: z.array(
    z.object({
      ingredientId: IdSchema,
      quantity: CanonicalQuantitySchema,
    }),
  ),
  manual: z.array(
    z.object({
      id: IdSchema,
      ingredientId: IdSchema,
      quantity: CanonicalQuantitySchema,
    }),
  ),
});
export type ShoppingOverlay = z.infer<typeof ShoppingOverlaySchema>;

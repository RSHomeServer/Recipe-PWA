import { z } from "zod";

export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;

/** Local calendar day: YYYY-MM-DD */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected IsoDate YYYY-MM-DD");
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** ISO-8601 datetime; accepts `Z` and numeric offsets. */
export const IsoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "expected IsoDateTime",
  });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

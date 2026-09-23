import { z } from "zod";
import { IsoDateSchema } from "../shared/primitives";

export const ShoppingWindowPreferenceSchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
});

export const SettingsSchema = z.object({
  id: z.literal("singleton"),
  dailyCalorieTarget: z.number().finite().positive().nullable(),
  weekStartsOn: z.literal(1),
  themePreference: z.enum(["light", "dark", "system"]),
  /** Last shopping date range; null → UI uses default today → +6. */
  shoppingWindow: ShoppingWindowPreferenceSchema.nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  dailyCalorieTarget: null,
  weekStartsOn: 1,
  themePreference: "system",
  shoppingWindow: null,
};

/** Normalize legacy settings rows that predate shoppingWindow. */
export function normalizeSettingsRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  if ("shoppingWindow" in record) return row;
  return { ...record, shoppingWindow: null };
}

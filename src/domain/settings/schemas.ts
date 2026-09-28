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
  /** Plan/Cook "How this works" panel dismissed (ADR-003 / V2). */
  howItWorksDismissed: z.boolean(),
  /** Starter-pack seed watermark; null until first successful seed (ADR-002). */
  starterPackVersion: z.string().nullable(),
  /** Flavour-pack seed watermark; null until first successful seed (ADR-006). */
  flavourPackVersion: z.string().nullable(),
  /**
   * Show the git tip banner at the top of every screen (dev/preview clarity).
   * Defaults on so the served tip is obvious while validating feature branches.
   */
  showDevTipBanner: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  dailyCalorieTarget: null,
  weekStartsOn: 1,
  themePreference: "system",
  shoppingWindow: null,
  howItWorksDismissed: false,
  starterPackVersion: null,
  flavourPackVersion: null,
  showDevTipBanner: true,
};

/** Normalize legacy settings rows that predate V1 shoppingWindow / V2–V3 fields. */
export function normalizeSettingsRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const record = row as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };
  if (!("shoppingWindow" in next)) next.shoppingWindow = null;
  if (!("howItWorksDismissed" in next)) next.howItWorksDismissed = false;
  if (!("starterPackVersion" in next)) next.starterPackVersion = null;
  if (!("flavourPackVersion" in next)) next.flavourPackVersion = null;
  if (!("showDevTipBanner" in next) || typeof next.showDevTipBanner !== "boolean") {
    next.showDevTipBanner = true;
  }
  return next;
}

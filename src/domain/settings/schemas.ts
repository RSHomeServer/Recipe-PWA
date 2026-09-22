import { z } from "zod";

export const SettingsSchema = z.object({
  id: z.literal("singleton"),
  dailyCalorieTarget: z.number().finite().positive().nullable(),
  weekStartsOn: z.literal(1),
  themePreference: z.enum(["light", "dark", "system"]),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  dailyCalorieTarget: null,
  weekStartsOn: 1,
  themePreference: "system",
};

import type { IsoDate } from "../shared/primitives";
import {
  parseIsoDate,
  toIsoDate,
  todayIso,
} from "../planning/dates";
import type { DateRange } from "../planning/requirements";

export type ShoppingWindow = DateRange;

/** `${from}_${to}` — overlay identity; ticks never silently migrate. */
export function windowKey(window: ShoppingWindow): string {
  return `${window.from}_${window.to}`;
}

/** Default shopping window: today through today + 6 (7 days inclusive). */
export function defaultShoppingWindow(now = new Date()): ShoppingWindow {
  return shoppingPreset(7, now);
}

/** Preset of N inclusive days starting today. */
export function shoppingPreset(
  days: 7 | 14,
  now = new Date(),
): ShoppingWindow {
  const from = todayIso(now);
  const end = parseIsoDate(from);
  end.setDate(end.getDate() + days - 1);
  return { from, to: toIsoDate(end) };
}

/** Shift both ends by the same number of days (week nudge = ±7). */
export function shiftShoppingWindow(
  window: ShoppingWindow,
  days: number,
): ShoppingWindow {
  const from = parseIsoDate(window.from);
  const to = parseIsoDate(window.to);
  from.setDate(from.getDate() + days);
  to.setDate(to.getDate() + days);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function formatShoppingWindowLabel(window: ShoppingWindow): string {
  const from = parseIsoDate(window.from);
  const to = parseIsoDate(window.to);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
  };
  return `Shopping for ${from.toLocaleDateString(undefined, opts)} – ${to.toLocaleDateString(undefined, opts)}`;
}

export function parseWindowKey(key: string): ShoppingWindow | null {
  const [from, to] = key.split("_");
  if (!from || !to) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return null;
  }
  return { from: from as IsoDate, to: to as IsoDate };
}

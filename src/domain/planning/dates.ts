import type { IsoDate } from "../shared/primitives";
import type { DateRange } from "./requirements";

/** Parse YYYY-MM-DD as a local calendar date (noon avoids DST edge cases). */
export function parseIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(now = new Date()): IsoDate {
  return toIsoDate(now);
}

/**
 * Calendar week containing `anchor`, starting on `weekStartsOn` (0=Sun … 6=Sat).
 * Settings V1 fixes Monday (`1`).
 */
export function weekContaining(
  anchor: IsoDate,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1,
): DateRange {
  const date = parseIsoDate(anchor);
  const day = date.getDay(); // 0 Sun … 6 Sat
  const offset = (day - weekStartsOn + 7) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

/** Seven inclusive IsoDates from `from` through `to` (expects a 7-day week). */
export function eachDateInRange(range: DateRange): IsoDate[] {
  const dates: IsoDate[] = [];
  const cursor = parseIsoDate(range.from);
  const end = parseIsoDate(range.to);
  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function shiftWeek(range: DateRange, weeks: number): DateRange {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  from.setDate(from.getDate() + weeks * 7);
  to.setDate(to.getDate() + weeks * 7);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function formatDayHeading(iso: IsoDate): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatWeekRangeLabel(range: DateRange): string {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  const sameMonth = from.getMonth() === to.getMonth();
  const fromLabel = from.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const toLabel = to.toLocaleDateString(undefined, {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  return `${fromLabel} – ${toLabel}`;
}

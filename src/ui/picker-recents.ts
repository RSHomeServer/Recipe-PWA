const STORAGE_PREFIX = "recipe-pwa:picker-recents:";

/** Cap matches ADR-004 §5 recents rail. */
const MAX_RECENTS = 12;

export function readPickerRecents(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function rememberPickerRecent(key: string, id: string): string[] {
  if (!id) return readPickerRecents(key);
  const next = [id, ...readPickerRecents(key).filter((x) => x !== id)].slice(
    0,
    MAX_RECENTS,
  );
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(next));
    } catch {
      // Ignore quota / private mode.
    }
  }
  return next;
}

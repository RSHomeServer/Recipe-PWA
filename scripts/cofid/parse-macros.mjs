/**
 * CoFID sentinel and numeric parsing (ADR-002 §2a / R2.5d).
 * Tr → 0; N → exclude the whole entry (never map N→0).
 */

/**
 * @typedef {"ok" | "exclude" | "incomplete"} MacroParseStatus
 */

/**
 * @typedef {{
 *   status: MacroParseStatus;
 *   kcal?: number;
 *   proteinG?: number;
 *   carbsG?: number;
 *   fatG?: number;
 *   reason?: string;
 * }} MacroParseResult
 */

/**
 * @param {unknown} value
 * @returns {"N" | "Tr" | "empty" | "number"}
 */
export function classifyMacroCell(value) {
  if (value == null) return "empty";
  const raw = String(value).trim();
  if (raw === "") return "empty";
  const upper = raw.toUpperCase();
  if (upper === "N") return "N";
  if (upper === "TR") return "Tr";
  return "number";
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseMacroNumber(value) {
  const kind = classifyMacroCell(value);
  if (kind === "Tr") return 0;
  if (kind !== "number") return null;
  const n = Number(String(value).trim().replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Parse the four required macros. Any `N` excludes the entry.
 * @param {{ kcals: unknown; prot: unknown; fat: unknown; cho: unknown }} cells
 * @returns {MacroParseResult}
 */
export function parseRequiredMacros(cells) {
  const fields = [
    ["kcal", cells.kcals],
    ["proteinG", cells.prot],
    ["fatG", cells.fat],
    ["carbsG", cells.cho],
  ];

  for (const [label, cell] of fields) {
    if (classifyMacroCell(cell) === "N") {
      return {
        status: "exclude",
        reason: `${label} is N (present but no reliable figure)`,
      };
    }
  }

  /** @type {Record<string, number>} */
  const out = {};
  for (const [label, cell] of fields) {
    const n = parseMacroNumber(cell);
    if (n == null) {
      return {
        status: "incomplete",
        reason: `${label} missing or unparseable`,
      };
    }
    out[label] = n;
  }

  return {
    status: "ok",
    kcal: out.kcal,
    proteinG: out.proteinG,
    fatG: out.fatG,
    carbsG: out.carbsG,
  };
}

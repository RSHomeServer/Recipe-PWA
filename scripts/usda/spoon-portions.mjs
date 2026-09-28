/**
 * Extract cited grams-per-tsp / grams-per-tbsp from USDA SR Legacy food_portion
 * rows (ADR-008). Never estimates, interpolates, or derives one spoon from the other.
 *
 * SR Legacy often stores spoons as measure_unit_id 9999 (undetermined) with
 * modifier "tsp" / "tbsp" rather than dedicated teaspoon/tablespoon unit ids.
 */

/**
 * @param {string} unitName
 * @param {string} modifier
 * @param {string} portionDescription
 * @returns {"tsp" | "tbsp" | null}
 */
export function spoonKindFromPortion(unitName, modifier, portionDescription) {
  const unit = unitName.trim().toLowerCase();
  if (unit === "tablespoon" || unit === "tablespoons") return "tbsp";
  if (unit === "teaspoon" || unit === "teaspoons") return "tsp";

  // Prefer anchored modifier matches so "packet (2/3 tbsp)" is a candidate but
  // never invents a weight from non-spoon prose. Callers prefer plain "tsp"/"tbsp".
  const mod = modifier.trim();
  if (/^(tbsp|tablespoon)\b/i.test(mod)) return "tbsp";
  if (/^(tsp|teaspoon)\b/i.test(mod)) return "tsp";

  const desc = portionDescription.trim().toLowerCase();
  if (/^(tbsp|tablespoon)\b/.test(desc)) return "tbsp";
  if (/^(tsp|teaspoon)\b/.test(desc)) return "tsp";
  return null;
}

/**
 * @param {{ amount: number; gramWeight: number; modifier: string; seqNum: number }} row
 */
function preferenceScore(row) {
  const mod = row.modifier.toLowerCase();
  let score = 0;
  if (/\bground\b/.test(mod)) score += 4;
  if (!/\bwhole\b/.test(mod)) score += 2;
  if (!/\bleaves\b/.test(mod)) score += 1;
  // Prefer plainer modifiers ("tsp" over "tsp, drained").
  score -= Math.min(mod.length, 40) * 0.01;
  score -= row.seqNum * 0.0001;
  return score;
}

/**
 * Pick a single cited grams-per-spoon from portion candidates.
 * Prefers amount === 1; never invents a weight when no spoon portion exists.
 *
 * @param {Array<{ amount: number; gramWeight: number; modifier: string; seqNum: number }>} candidates
 * @returns {number | null}
 */
export function pickCitedGramsPerSpoon(candidates) {
  const usable = candidates.filter(
    (row) =>
      Number.isFinite(row.amount) &&
      row.amount > 0 &&
      Number.isFinite(row.gramWeight) &&
      row.gramWeight > 0,
  );
  if (usable.length === 0) return null;

  const ones = usable.filter((row) => row.amount === 1);
  const pool = ones.length > 0 ? ones : usable;
  pool.sort((a, b) => preferenceScore(b) - preferenceScore(a));
  const best = pool[0];
  const grams = best.gramWeight / best.amount;
  if (!Number.isFinite(grams) || grams <= 0) return null;
  // Match pack rounding used for macros (1 decimal).
  return Math.round(grams * 10) / 10;
}

/**
 * @param {string} csvDir
 * @param {Set<number>} fdcIds
 * @param {(filePath: string, onRow: (row: Record<string, string>) => void) => Promise<void>} forEachCsvRow
 * @returns {Promise<Map<number, { gramsPerTsp: number | null; gramsPerTbsp: number | null }>>}
 */
export async function loadSpoonWeights(csvDir, fdcIds, forEachCsvRow) {
  const path = await import("node:path");
  const measurePath = path.join(csvDir, "measure_unit.csv");
  const portionPath = path.join(csvDir, "food_portion.csv");

  /** @type {Map<string, string>} */
  const unitNames = new Map();
  await forEachCsvRow(measurePath, (row) => {
    unitNames.set(String(row.id), String(row.name ?? ""));
  });

  /** @type {Map<number, { tsp: object[]; tbsp: object[] }>} */
  const byFood = new Map();
  for (const id of fdcIds) {
    byFood.set(id, { tsp: [], tbsp: [] });
  }

  await forEachCsvRow(portionPath, (row) => {
    const fdcId = Number(row.fdc_id);
    if (!fdcIds.has(fdcId)) return;
    const bag = byFood.get(fdcId);
    if (!bag) return;
    const unitName = unitNames.get(String(row.measure_unit_id)) ?? "";
    const modifier = String(row.modifier ?? "");
    const portionDescription = String(row.portion_description ?? "");
    const kind = spoonKindFromPortion(unitName, modifier, portionDescription);
    if (!kind) return;
    const candidate = {
      amount: Number(row.amount),
      gramWeight: Number(row.gram_weight),
      modifier,
      seqNum: Number(row.seq_num) || 0,
    };
    bag[kind].push(candidate);
  });

  /** @type {Map<number, { gramsPerTsp: number | null; gramsPerTbsp: number | null }>} */
  const out = new Map();
  for (const [fdcId, bag] of byFood) {
    out.set(fdcId, {
      gramsPerTsp: pickCitedGramsPerSpoon(bag.tsp),
      gramsPerTbsp: pickCitedGramsPerSpoon(bag.tbsp),
    });
  }
  return out;
}

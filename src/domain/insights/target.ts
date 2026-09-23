/** Presentational only — never feeds a calculation. */
export function remaining(target: number, consumedKcal: number): number {
  return target - consumedKcal;
}

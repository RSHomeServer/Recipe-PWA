import { describe, expect, it } from "vitest";
import {
  EPSILON,
  formatQuantity,
  fromCanonical,
  isEnough,
  isShort,
  isZero,
  sumQuantities,
  toCanonical,
  UNITS,
  withinTolerance,
  zeroQuantity,
  type MeasureKind,
  type Quantity,
  type Unit,
} from "./index";

const MASS_UNITS = (Object.keys(UNITS) as Unit[]).filter(
  (u) => UNITS[u].kind === "mass",
);
const VOLUME_UNITS = (Object.keys(UNITS) as Unit[]).filter(
  (u) => UNITS[u].kind === "volume",
);
const ALL_UNITS = Object.keys(UNITS) as Unit[];

describe("UNIT_MODEL §Testable properties", () => {
  describe("1. toCanonical round-trips within tolerance for in-family pairs", () => {
    const cases: { q: Quantity; kind: MeasureKind }[] = [
      { q: { value: 1.2, unit: "kg" }, kind: "mass" },
      { q: { value: 850, unit: "g" }, kind: "mass" },
      { q: { value: 12.5, unit: "g" }, kind: "mass" },
      { q: { value: 1.65, unit: "L" }, kind: "volume" },
      { q: { value: 250, unit: "ml" }, kind: "volume" },
      { q: { value: 3, unit: "item" }, kind: "count" },
      { q: { value: 0.5, unit: "item" }, kind: "count" },
    ];

    it.each(cases)("round-trips $q.value $q.unit", ({ q, kind }) => {
      const converted = toCanonical(q, kind);
      expect(converted.ok).toBe(true);
      if (!converted.ok) return;
      const back = fromCanonical(converted.canonical, q.unit);
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(withinTolerance(back.quantity.value, q.value, kind)).toBe(true);
    });

    it("1.2 kg → 1200 g → 1.2 kg", () => {
      const c = toCanonical({ value: 1.2, unit: "kg" }, "mass");
      expect(c).toEqual({
        ok: true,
        canonical: { amount: 1200, kind: "mass" },
      });
      if (!c.ok) return;
      const back = fromCanonical(c.canonical, "kg");
      expect(back.ok && back.quantity.value).toBeCloseTo(1.2, 10);
    });

    it.each(MASS_UNITS)("mass unit %s is in-family for mass", (unit) => {
      expect(toCanonical({ value: 1, unit }, "mass").ok).toBe(true);
    });

    it.each(VOLUME_UNITS)("volume unit %s is in-family for volume", (unit) => {
      expect(toCanonical({ value: 1, unit }, "volume").ok).toBe(true);
    });
  });

  describe("2. cross-family returns wrongFamily — never throw, never fabricate", () => {
    const cross: { q: Quantity; kind: MeasureKind }[] = [
      { q: { value: 250, unit: "ml" }, kind: "mass" },
      { q: { value: 1, unit: "kg" }, kind: "volume" },
      { q: { value: 2, unit: "item" }, kind: "mass" },
      { q: { value: 100, unit: "g" }, kind: "count" },
    ];

    it.each(cross)("$q.unit against $kind → wrongFamily", ({ q, kind }) => {
      expect(() => toCanonical(q, kind)).not.toThrow();
      const result = toCanonical(q, kind);
      expect(result).toMatchObject({
        ok: false,
        reason: "wrongFamily",
        expected: kind,
      });
      if (result.ok) return;
      expect(result.allowed.every((u) => UNITS[u].kind === kind)).toBe(true);
      expect("canonical" in result).toBe(false);
    });

    it("fromCanonical also refuses wrong-family units", () => {
      const result = fromCanonical({ amount: 100, kind: "mass" }, "ml");
      expect(result).toMatchObject({ ok: false, reason: "wrongFamily" });
    });
  });

  describe("3. format(toCanonical(q)) is stable and respects precision rules", () => {
    const cases: { q: Quantity; kind: MeasureKind; expected: string }[] = [
      { q: { value: 1.2, unit: "kg" }, kind: "mass", expected: "1.2 kg" },
      { q: { value: 850, unit: "g" }, kind: "mass", expected: "850 g" },
      { q: { value: 12.5, unit: "g" }, kind: "mass", expected: "12.5 g" },
      { q: { value: 1.65, unit: "L" }, kind: "volume", expected: "1.65 L" },
      { q: { value: 250, unit: "ml" }, kind: "volume", expected: "250 ml" },
      { q: { value: 3, unit: "item" }, kind: "count", expected: "3" },
      { q: { value: 0.5, unit: "item" }, kind: "count", expected: "0.5" },
    ];

    it.each(cases)("$expected from $q.value $q.unit", ({ q, kind, expected }) => {
      const c = toCanonical(q, kind);
      expect(c.ok).toBe(true);
      if (!c.ok) return;
      const once = formatQuantity(c.canonical);
      const twice = formatQuantity(c.canonical);
      expect(once).toBe(expected);
      expect(twice).toBe(once);
    });

    it("displayUnit override keeps recipe wording", () => {
      const c = toCanonical({ value: 1.2, unit: "kg" }, "mass");
      expect(c.ok).toBe(true);
      if (!c.ok) return;
      expect(formatQuantity(c.canonical, { displayUnit: "kg" })).toBe("1.2 kg");
      expect(formatQuantity(c.canonical, { displayUnit: "g" })).toBe("1200 g");
    });

    it("never emits more than allowed decimals", () => {
      const kg = formatQuantity({ amount: 1234.5678, kind: "mass" });
      expect(kg).toMatch(/^\d+(\.\d{1,2})? kg$/);
      const small = formatQuantity({ amount: 12.567, kind: "mass" });
      expect(small).toMatch(/^\d+(\.\d)? g$/);
    });
  });

  describe("4. isShort and isEnough are exact complements around EPSILON", () => {
    it.each(["mass", "volume", "count"] as MeasureKind[])(
      "%s: complements at and around the boundary",
      (kind) => {
        const eps = EPSILON[kind];
        const required = 100;
        const samples = [
          required - 2 * eps,
          required - eps,
          required,
          required + eps,
          required + 2 * eps,
          required + eps * 0.5,
          required + eps * 1.5,
        ];
        for (const available of samples) {
          const short = isShort(required, available, kind);
          const enough = isEnough(required, available, kind);
          expect(short).toBe(!enough);
        }
      },
    );

    it("isZero uses the same epsilon", () => {
      expect(isZero(EPSILON.mass, "mass")).toBe(true);
      expect(isZero(EPSILON.mass * 2, "mass")).toBe(false);
      expect(isZero(-EPSILON.count, "count")).toBe(true);
    });
  });

  describe("5. sumQuantities is commutative within tolerance; empty → zero", () => {
    it("empty → zero of the requested kind", () => {
      expect(sumQuantities([], "mass")).toEqual(zeroQuantity("mass"));
      expect(sumQuantities([], "volume")).toEqual(zeroQuantity("volume"));
      expect(sumQuantities([], "count")).toEqual(zeroQuantity("count"));
    });

    it("commutative within tolerance", () => {
      const a = { amount: 0.1, kind: "mass" as const };
      const b = { amount: 0.2, kind: "mass" as const };
      const c = { amount: 0.3, kind: "mass" as const };
      const orders = [
        [a, b, c],
        [c, a, b],
        [b, c, a],
        [c, b, a],
      ];
      const totals = orders.map((qs) => sumQuantities(qs, "mass").amount);
      for (const t of totals) {
        expect(withinTolerance(t, totals[0]!, "mass")).toBe(true);
      }
    });

    it("rejects mixed families", () => {
      expect(() =>
        sumQuantities(
          [
            { amount: 1, kind: "mass" },
            { amount: 1, kind: "volume" },
          ],
          "mass",
        ),
      ).toThrow(/expected kind/);
    });
  });

  describe("6. scale by n then 1/n returns original within tolerance", () => {
    it.each([
      { amount: 500, kind: "mass" as const, n: 2 },
      { amount: 250, kind: "volume" as const, n: 3 },
      { amount: 0.5, kind: "count" as const, n: 4 },
      { amount: 1234.5, kind: "mass" as const, n: 7 },
    ])("amount $amount × $n × 1/$n", ({ amount, kind, n }) => {
      const scaled = amount * n;
      const restored = scaled * (1 / n);
      expect(withinTolerance(restored, amount, kind)).toBe(true);
    });
  });

  describe("7. fractional counts survive without integer rounding", () => {
    it("0.5 item round-trips and formats as fractional", () => {
      const c = toCanonical({ value: 0.5, unit: "item" }, "count");
      expect(c.ok).toBe(true);
      if (!c.ok) return;
      expect(c.canonical.amount).toBe(0.5);
      expect(formatQuantity(c.canonical)).toBe("0.5");
      expect(Number.isInteger(c.canonical.amount)).toBe(false);
    });

    it("1/3 item is not coerced to an integer", () => {
      const c = toCanonical({ value: 1 / 3, unit: "item" }, "count");
      expect(c.ok).toBe(true);
      if (!c.ok) return;
      expect(c.canonical.amount).toBeCloseTo(1 / 3, 12);
      expect(formatQuantity(c.canonical)).not.toMatch(/^\d+$/);
    });
  });

  describe("8. negative pantry quantities format correctly and are never clamped", () => {
    it("formats negatives with a leading minus", () => {
      expect(formatQuantity({ amount: -1200, kind: "mass" })).toBe("-1.2 kg");
      expect(formatQuantity({ amount: -250, kind: "volume" })).toBe("-250 ml");
      expect(formatQuantity({ amount: -0.5, kind: "count" })).toBe("-0.5");
    });

    it("domain sum does not clamp negatives to zero", () => {
      const result = sumQuantities(
        [
          { amount: -50, kind: "mass" },
          { amount: 20, kind: "mass" },
        ],
        "mass",
      );
      expect(result.amount).toBe(-30);
    });

    it("every unit key remains a known UNITS entry", () => {
      for (const unit of ALL_UNITS) {
        expect(UNITS[unit]).toBeDefined();
      }
    });
  });
});

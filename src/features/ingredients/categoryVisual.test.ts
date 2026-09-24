import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORY_ACCENT,
  type IngredientCategory,
} from "@/domain";
import {
  resolveCategoryAccent,
  resolveCategoryIcon,
  resolveCategoryVisual,
} from "@/features/ingredients/categoryVisual";

const sample: IngredientCategory = {
  id: "11111111-1111-4111-8111-111111111101",
  name: "Produce",
  sortOrder: 10,
  icon: "Leaf",
  accent: "--color-success",
};

describe("categoryVisual", () => {
  it("resolves known Lucide names and accent tokens", () => {
    const visual = resolveCategoryVisual(sample);
    expect(visual.icon).toBe(resolveCategoryIcon("Leaf"));
    expect(visual.accent).toBe("--color-success");
    expect(resolveCategoryIcon("Leaf")).not.toBe(resolveCategoryIcon("Beef"));
  });

  it("falls back for unknown icon names and invalid accents", () => {
    expect(resolveCategoryIcon("NotARealIcon")).toBe(
      resolveCategoryIcon("Circle"),
    );
    expect(resolveCategoryAccent("red")).toBe(DEFAULT_CATEGORY_ACCENT);
    expect(resolveCategoryAccent("var(--color-success)")).toBe(
      DEFAULT_CATEGORY_ACCENT,
    );
    expect(resolveCategoryVisual(null).accent).toBe(DEFAULT_CATEGORY_ACCENT);
  });
});

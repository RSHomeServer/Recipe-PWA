import { describe, expect, it } from "vitest";
import {
  IngredientSchema,
  defaultUserEnteredSource,
  type Ingredient,
} from "@/domain";
import {
  EMPTY_FLAVOUR_LAB_FILTERS,
  effectiveKcalForCeiling,
  filterFlavourIngredients,
  matchesFlavourFilters,
} from "./filters";

function spice(
  overrides: Partial<Ingredient> & Pick<Ingredient, "id" | "name">,
): Ingredient {
  return IngredientSchema.parse({
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 50, proteinG: 1, carbsG: 5, fatG: 1, sodiumMg: 100 },
    notes: null,
    archivedAt: null,
    source: defaultUserEnteredSource(),
    imageId: null,
    common: true,
    gramsPerTsp: null,
    gramsPerTbsp: null,
    flavourTags: [],
    ...overrides,
  });
}

const sourSpicy = spice({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  name: "Chilli vinegar",
  flavourTags: ["sour", "spicy"],
  nutrition: { kcal: 22, proteinG: 0, carbsG: 0.5, fatG: 0, sodiumMg: 40 },
  gramsPerTsp: 5,
});

const sourOnly = spice({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  name: "Cider vinegar",
  flavourTags: ["sour"],
  nutrition: { kcal: 21, proteinG: 0, carbsG: 0.9, fatG: 0, sodiumMg: 5 },
});

const unknownSodium = spice({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  name: "Mystery spice",
  flavourTags: ["spicy"],
  nutrition: { kcal: 10, proteinG: 0, carbsG: 1, fatG: 0, sodiumMg: null },
  gramsPerTsp: 2,
});

const dense = spice({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
  name: "Tahini-ish",
  flavourTags: ["nutty"],
  nutrition: { kcal: 607, proteinG: 17, carbsG: 21, fatG: 54, sodiumMg: 50 },
  common: false,
});

describe("Flavour Lab filters (R5.2–R5.3)", () => {
  it("intersects multiple tags", () => {
    const filters = {
      ...EMPTY_FLAVOUR_LAB_FILTERS,
      tags: ["sour", "spicy"] as const,
    };
    expect(matchesFlavourFilters(sourSpicy, filters)).toBe(true);
    expect(matchesFlavourFilters(sourOnly, filters)).toBe(false);
    expect(
      filterFlavourIngredients(
        [sourSpicy, sourOnly, unknownSodium],
        filters,
      ).map((i) => i.name),
    ).toEqual(["Chilli vinegar"]);
  });

  it("excludes unknown sodium from a sodium ceiling (not treated as 0)", () => {
    const filters = {
      ...EMPTY_FLAVOUR_LAB_FILTERS,
      maxSodiumMg: 100,
    };
    expect(matchesFlavourFilters(sourSpicy, filters)).toBe(true);
    expect(matchesFlavourFilters(unknownSodium, filters)).toBe(false);
    expect(
      matchesFlavourFilters(unknownSodium, {
        ...EMPTY_FLAVOUR_LAB_FILTERS,
        maxSodiumMg: null,
      }),
    ).toBe(true);
  });

  it("applies kcal ceiling per tsp when cited, else per 100 g", () => {
    // 22 kcal/100g × 5 g/tsp = 1.1 kcal/tsp → under 10
    expect(effectiveKcalForCeiling(sourSpicy)).toBeCloseTo(1.1, 5);
    expect(
      matchesFlavourFilters(sourSpicy, {
        ...EMPTY_FLAVOUR_LAB_FILTERS,
        maxKcal: 10,
      }),
    ).toBe(true);

    // no tsp → compare 607 kcal/100g
    expect(effectiveKcalForCeiling(dense)).toBe(607);
    expect(
      matchesFlavourFilters(dense, {
        ...EMPTY_FLAVOUR_LAB_FILTERS,
        maxKcal: 10,
        commonOnly: false,
      }),
    ).toBe(false);
  });

  it("honours commonOnly", () => {
    expect(
      matchesFlavourFilters(dense, {
        ...EMPTY_FLAVOUR_LAB_FILTERS,
        commonOnly: true,
      }),
    ).toBe(false);
    expect(
      matchesFlavourFilters(dense, {
        ...EMPTY_FLAVOUR_LAB_FILTERS,
        commonOnly: false,
      }),
    ).toBe(true);
  });
});

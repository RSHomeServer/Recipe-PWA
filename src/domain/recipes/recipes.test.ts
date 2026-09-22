import { describe, expect, it } from "vitest";
import {
  IngredientSchema,
  RecipeFormSchema,
  buildRecipeFields,
  mergeLineDrafts,
  type Ingredient,
} from "@/domain";

const chickenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const riceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const lineA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const lineB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function chicken(): Ingredient {
  return IngredientSchema.parse({
    id: chickenId,
    name: "Chicken",
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 120, proteinG: 22, carbsG: 0, fatG: 3 },
    notes: null,
    archivedAt: null,
  });
}

function rice(): Ingredient {
  return IngredientSchema.parse({
    id: riceId,
    name: "Rice",
    categoryId: null,
    measureKind: "mass",
    nutrition: { kcal: 350, proteinG: 7, carbsG: 78, fatG: 1 },
    notes: null,
    archivedAt: null,
  });
}

describe("RecipeFormSchema", () => {
  it("trims name and requires positive servings", () => {
    const parsed = RecipeFormSchema.parse({
      name: "  Curry  ",
      servings: 4,
      lines: [],
      steps: ["  Mix  ", ""],
      tagsText: " dinner ",
      notes: "  ",
    });
    expect(parsed.name).toBe("Curry");
    expect(parsed.servings).toBe(4);
  });

  it("rejects zero servings", () => {
    expect(() =>
      RecipeFormSchema.parse({
        name: "Curry",
        servings: 0,
        lines: [],
        steps: [],
        tagsText: "",
        notes: "",
      }),
    ).toThrow();
  });
});

describe("buildRecipeFields", () => {
  it("converts display units and merges duplicate ingredients", () => {
    const map = new Map([
      [chickenId, chicken()],
      [riceId, rice()],
    ]);
    const result = buildRecipeFields(
      RecipeFormSchema.parse({
        name: "Curry",
        servings: 2,
        lines: [
          {
            id: lineA,
            ingredientId: chickenId,
            amount: 0.5,
            displayUnit: "kg",
            optional: false,
            note: "diced",
          },
          {
            id: lineB,
            ingredientId: chickenId,
            amount: 200,
            displayUnit: "g",
            optional: true,
            note: "extra",
          },
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            ingredientId: riceId,
            amount: 300,
            displayUnit: "g",
            optional: false,
            note: "",
          },
        ],
        steps: ["Cook"],
        tagsText: "",
        notes: "",
      }),
      map,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fields.lines).toHaveLength(2);
    const chickenLine = result.fields.lines.find(
      (l) => l.ingredientId === chickenId,
    );
    expect(chickenLine?.quantity).toEqual({ amount: 700, kind: "mass" });
    expect(chickenLine?.optional).toBe(false);
    expect(chickenLine?.note).toBe("diced; extra");
  });

  it("rejects wrong-family units", () => {
    const map = new Map([[chickenId, chicken()]]);
    const result = buildRecipeFields(
      RecipeFormSchema.parse({
        name: "Bad",
        servings: 1,
        lines: [
          {
            id: lineA,
            ingredientId: chickenId,
            amount: 1,
            displayUnit: "ml",
            optional: false,
            note: "",
          },
        ],
        steps: [],
        tagsText: "",
        notes: "",
      }),
      map,
    );
    expect(result.ok).toBe(false);
  });
});

describe("mergeLineDrafts", () => {
  it("sums amounts in canonical space", () => {
    const merged = mergeLineDrafts(
      {
        id: lineA,
        ingredientId: chickenId,
        amount: 1,
        displayUnit: "kg",
        optional: false,
        note: "",
      },
      {
        id: lineB,
        ingredientId: chickenId,
        amount: 250,
        displayUnit: "g",
        optional: false,
        note: "more",
      },
      "mass",
    );
    expect(merged.amount).toBe(1.25);
    expect(merged.displayUnit).toBe("kg");
    expect(merged.note).toBe("more");
  });
});

import { describe, expect, it } from "vitest";
import {
  BATCH_UNAVAILABLE_REASON,
  ENTRY_SOURCE_QUESTION,
  logEntryKindOptions,
  planEntryKindOptions,
} from "./entry-kind-copy";

describe("entry-kind copy (ADR-003)", () => {
  it("uses the binding composer question", () => {
    expect(ENTRY_SOURCE_QUESTION).toBe("Where's this coming from?");
  });

  it("plan options match ADR-003 §3 labels and helpers", () => {
    const options = planEntryKindOptions(true);
    expect(options.map((o) => o.label)).toEqual([
      "Cook a recipe",
      "Eat a portion you already cooked",
      "Eat or heat one item",
    ]);
    expect(options[0]?.helperText).toContain("shopping list");
    expect(options[1]?.disabled).toBeFalsy();
  });

  it("disables batch option with a visible reason when none exist", () => {
    const options = planEntryKindOptions(false);
    const batch = options.find((o) => o.value === "batchPortions");
    expect(batch?.disabled).toBe(true);
    expect(batch?.disabledReason).toBe(BATCH_UNAVAILABLE_REASON);
  });

  it("log options keep custom food as a fourth choice", () => {
    const options = logEntryKindOptions(true);
    expect(options).toHaveLength(4);
    expect(options[3]?.value).toBe("customFood");
  });
});

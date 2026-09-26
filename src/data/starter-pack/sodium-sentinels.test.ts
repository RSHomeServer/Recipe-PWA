import { describe, expect, it } from "vitest";
import {
  parseRequiredMacros,
  parseSodiumMg,
} from "../../../scripts/cofid/parse-macros.mjs";

describe("CoFID sodium sentinels (R2.5 / ADR-007)", () => {
  it("maps Tr → 0, N → null, blank → null", () => {
    expect(parseSodiumMg("Tr")).toBe(0);
    expect(parseSodiumMg("tr")).toBe(0);
    expect(parseSodiumMg("N")).toBeNull();
    expect(parseSodiumMg("n")).toBeNull();
    expect(parseSodiumMg("")).toBeNull();
    expect(parseSodiumMg(null)).toBeNull();
    expect(parseSodiumMg(undefined)).toBeNull();
    expect(parseSodiumMg(480)).toBe(480);
  });

  it("still excludes foods when a macro is N", () => {
    expect(
      parseRequiredMacros({
        kcals: 100,
        prot: "N",
        fat: 1,
        cho: 2,
      }).status,
    ).toBe("exclude");
  });
});

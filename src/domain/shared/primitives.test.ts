import { describe, expect, it } from "vitest";
import { IdSchema, createId } from "./primitives";

describe("createId", () => {
  it("returns a Zod UUID", () => {
    const id = createId();
    expect(IdSchema.parse(id)).toBe(id);
  });

  it("returns distinct ids", () => {
    expect(createId()).not.toBe(createId());
  });

  it("works when randomUUID is missing", () => {
    const original = globalThis.crypto;
    const getRandomValues = original.getRandomValues.bind(original);
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues },
    });
    try {
      expect(IdSchema.safeParse(createId()).success).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: original,
      });
    }
  });
});

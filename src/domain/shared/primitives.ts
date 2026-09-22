import { z } from "zod";

export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;

/** Local calendar day: YYYY-MM-DD */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected IsoDate YYYY-MM-DD");
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** ISO-8601 datetime; accepts `Z` and numeric offsets. */
export const IsoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "expected IsoDateTime",
  });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/**
 * UUID v4 for entity ids. Prefers `crypto.randomUUID`, then `getRandomValues`,
 * then a Math.random fallback — `randomUUID` is missing on non-secure HTTP
 * origins (e.g. LAN IP:port) even when the rest of the app works.
 */
export function createId(): Id {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return IdSchema.parse(cryptoApi.randomUUID());
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 version 4 / variant 1
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return IdSchema.parse(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
  );
}

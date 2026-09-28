import { createHash } from "node:crypto";

/**
 * Deterministic UUID (version-4 layout) from a stable key so re-transcodes
 * keep the same ingredient ids for the same FDC food.
 * @param {string} key
 * @returns {string}
 */
export function deterministicId(key) {
  const hash = createHash("sha256")
    .update(`recipe-pwa:flavour-pack:${key}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

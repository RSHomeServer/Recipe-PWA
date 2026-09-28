/**
 * Compatibility re-export — prefer `scripts/flavour-tags/apply.mjs`.
 * Kept so USDA/CoFID scripts that import `./flavour-tags.mjs` keep working.
 */

export {
  FLAVOUR_TAGS_PATH,
  loadFlavourTagMap as loadFlavourTagsMap,
  ingredientTagKey as flavourTagKey,
  applyFlavourTags,
  assertFlavourTagsMatch,
} from "../flavour-tags/apply.mjs";

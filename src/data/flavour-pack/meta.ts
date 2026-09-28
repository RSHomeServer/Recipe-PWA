import type { Ingredient } from "@/domain";
import metaJson from "./meta.json";

export type FlavourPackMeta = {
  version: string;
  dataset: {
    datasetId: string;
    datasetName: string;
    licence: string;
    url: string;
    retrievedAt: string;
  };
  brandedDataset?: {
    datasetId: string;
    datasetName: string;
    licence: string;
    url: string;
    retrievedAt: string;
  };
  attributionNote: string;
};

export type FlavourPackFile = {
  version: string;
  dataset: FlavourPackMeta["dataset"];
  generatedAt: string;
  stats: Record<string, number | string>;
  ingredients: Ingredient[];
};

export const flavourPackMeta = metaJson as FlavourPackMeta;

export const FLAVOUR_PACK_VERSION = flavourPackMeta.version;

/**
 * Attribution copy for Settings → About (R1.9).
 * CC0 does not require attribution; we give it voluntarily.
 */
export const FLAVOUR_PACK_ATTRIBUTION = {
  title: "Flavour reference data",
  datasetName: flavourPackMeta.dataset.datasetName,
  datasetUrl: flavourPackMeta.dataset.url,
  licenceLabel: "CC0 1.0 Universal (public domain)",
  licenceConfirmed: true,
  body: [
    "Seasonings and flavourings that CoFID does not cover well are transcribed by script from USDA FoodData Central (SR Legacy), plus a few Branded Foods exceptions where SR Legacy has no generic row (MSG, nutritional yeast, smoked paprika).",
    flavourPackMeta.attributionNote,
  ].join(" "),
};

let cachedPack: FlavourPackFile | null = null;

function flavourPackUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return new URL("starter-pack/flavour-pack.json", base).href;
  }
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}starter-pack/flavour-pack.json`;
}

/**
 * Load the USDA flavour pack from `/starter-pack/flavour-pack.json`.
 * Tests inject via `setFlavourPackForTests` or pass `pack` into seed helpers.
 */
export async function loadFlavourPack(): Promise<FlavourPackFile> {
  if (cachedPack) return cachedPack;
  const url = flavourPackUrl();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load flavour pack (${response.status}) from ${url}`);
  }
  cachedPack = (await response.json()) as FlavourPackFile;
  return cachedPack;
}

/** Test helper — avoid network/fetch for pack fixtures. */
export function setFlavourPackForTests(pack: FlavourPackFile | null): void {
  cachedPack = pack;
}

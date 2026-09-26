import type { Ingredient } from "@/domain";
import metaJson from "./meta.json";

export type StarterPackMeta = {
  version: string;
  dataset: {
    datasetId: string;
    datasetName: string;
    licence: string;
    url: string;
    retrievedAt: string;
  };
  attributionNote: string;
};

export type StarterPackFile = {
  version: string;
  dataset: StarterPackMeta["dataset"];
  generatedAt: string;
  stats: Record<string, number | string>;
  ingredients: Ingredient[];
};

export const starterPackMeta = metaJson as StarterPackMeta;

export const STARTER_PACK_VERSION = starterPackMeta.version;

/**
 * Attribution copy for Settings → About.
 * R2.12 resolved: GOV.UK CoFID page footer + CoFID 2021 user guide PDF → OGL v3.0.
 */
export const STARTER_PACK_ATTRIBUTION = {
  title: "Reference ingredient data",
  datasetName: starterPackMeta.dataset.datasetName,
  datasetUrl: starterPackMeta.dataset.url,
  licenceLabel: "Open Government Licence v3.0",
  licenceConfirmed: true,
  body: [
    "Starter ingredients are transcribed by script from the published UK CoFID workbook.",
    starterPackMeta.attributionNote,
  ].join(" "),
};

let cachedPack: StarterPackFile | null = null;

function starterPackUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return new URL("starter-pack/pack.json", base).href;
  }
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}starter-pack/pack.json`;
}

/**
 * Load the CoFID pack from `/starter-pack/pack.json` so the JSON is not
 * inlined into the JS bundle (Workbox size limit). Tests inject via
 * `setStarterPackForTests` or pass `pack` into `seedStarterPack`.
 */
export async function loadStarterPack(): Promise<StarterPackFile> {
  if (cachedPack) return cachedPack;
  const url = starterPackUrl();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load starter pack (${response.status}) from ${url}`);
  }
  cachedPack = (await response.json()) as StarterPackFile;
  return cachedPack;
}

/** Test helper — avoid network/fetch for pack fixtures. */
export function setStarterPackForTests(pack: StarterPackFile | null): void {
  cachedPack = pack;
}

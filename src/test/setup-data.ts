import "fake-indexeddb/auto";
import { beforeAll } from "vitest";
import { setFlavourPackForTests, setStarterPackForTests } from "@/data";
import packJson from "../../public/starter-pack/pack.json";
import flavourPackJson from "../../public/starter-pack/flavour-pack.json";
import type { StarterPackFile } from "@/data/starter-pack";
import type { FlavourPackFile } from "@/data/flavour-pack";

beforeAll(() => {
  setStarterPackForTests(packJson as StarterPackFile);
  setFlavourPackForTests(flavourPackJson as FlavourPackFile);
});

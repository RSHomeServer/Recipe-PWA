import "fake-indexeddb/auto";
import { beforeAll } from "vitest";
import { setStarterPackForTests } from "@/data";
import packJson from "../../public/starter-pack/pack.json";
import type { StarterPackFile } from "@/data/starter-pack";

beforeAll(() => {
  setStarterPackForTests(packJson as StarterPackFile);
});

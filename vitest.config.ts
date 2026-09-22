import path from "node:path";
import { defineConfig } from "vitest/config";

const root = __dirname;
const pwaBase = path.resolve(root, "../PWA-Base");
const alias = {
  "@": path.resolve(root, "./src"),
  dexie: path.resolve(root, "node_modules/dexie"),
  "@songara/pwa-base/preview/dexie": path.join(
    pwaBase,
    "packages/preview-dexie/src/index.ts",
  ),
};
const resolve = { alias, dedupe: ["dexie", "dexie-react-hooks"] };

export default defineConfig({
  resolve,
  test: {
    globalSetup: ["./src/test/global-setup.ts"],
    projects: [
      {
        resolve,
        test: {
          name: "domain",
          environment: "node",
          include: ["src/domain/**/*.{test,spec}.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "data",
          environment: "node",
          include: ["src/data/**/*.{test,spec}.ts"],
          setupFiles: ["./src/test/setup-data.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "app",
          environment: "jsdom",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/domain/**", "src/data/**"],
          setupFiles: ["./src/test/setup.ts"],
          css: true,
        },
      },
    ],
  },
});

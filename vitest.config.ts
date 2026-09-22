import path from "node:path";
import { defineConfig } from "vitest/config";

const pwaBase = path.resolve(__dirname, "../PWA-Base");
const alias = {
  "@": path.resolve(__dirname, "./src"),
  "@songara/pwa-base/preview/dexie": path.join(
    pwaBase,
    "packages/preview-dexie/src/index.ts",
  ),
};

export default defineConfig({
  resolve: { alias },
  test: {
    globalSetup: ["./src/test/global-setup.ts"],
    projects: [
      {
        resolve: { alias },
        test: {
          name: "domain",
          environment: "node",
          include: ["src/domain/**/*.{test,spec}.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "data",
          environment: "node",
          include: ["src/data/**/*.{test,spec}.ts"],
          setupFiles: ["./src/test/setup-data.ts"],
        },
      },
      {
        resolve: { alias },
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

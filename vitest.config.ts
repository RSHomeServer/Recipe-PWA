import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname, "./src"),
};

export default defineConfig({
  resolve: { alias },
  test: {
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
          name: "app",
          environment: "jsdom",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["src/domain/**"],
          setupFiles: ["./src/test/setup.ts"],
          css: true,
        },
      },
    ],
  },
});

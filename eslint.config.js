import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "domain/ must not import React.",
            },
            {
              name: "react-dom",
              message: "domain/ must not import React DOM.",
            },
            {
              name: "react-dom/client",
              message: "domain/ must not import React DOM.",
            },
            {
              name: "dexie",
              message: "domain/ must not import Dexie.",
            },
            {
              name: "dexie-react-hooks",
              message: "domain/ must not import Dexie.",
            },
            {
              name: "@songara/pwa-base/preview/dexie",
              message: "domain/ must not import Dexie.",
            },
          ],
          patterns: [
            {
              group: [
                "dexie/*",
                "dexie-react-hooks",
                "dexie-react-hooks/*",
                "@songara/pwa-base/preview/dexie",
                "@songara/pwa-base/preview/dexie/*",
                "react/*",
                "react-dom/*",
                "react-router",
                "react-router/*",
                "react-router-dom",
                "react-router-dom/*",
              ],
              message:
                "domain/ must not import React, routers, Dexie, or DOM packages.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/data/**", "src/types/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@songara/pwa-base/preview/dexie",
              message:
                "Dexie Preview imports belong in src/data/ only (ARCHITECTURE).",
            },
            {
              name: "dexie",
              message:
                "Dexie imports belong in src/data/ only (ARCHITECTURE).",
            },
          ],
          patterns: [
            {
              group: ["dexie/*", "@songara/pwa-base/preview/dexie/*"],
              message:
                "Dexie imports belong in src/data/ only (ARCHITECTURE).",
            },
          ],
        },
      ],
    },
  },
]);


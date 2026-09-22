import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appVersionPlugin } from "@songara/pwa-base/config/vite-app-version";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const root = path.dirname(fileURLToPath(import.meta.url));
const pwaBase = path.resolve(root, "../PWA-Base");
const platform = (pkg: string, ...segments: string[]) =>
  path.join(pwaBase, "packages", pkg, ...segments);

export default defineConfig({
  plugins: [
    appVersionPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Recipe",
        short_name: "Recipe",
        description: "Personal recipe, pantry, and meal planning",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#2F6B4F",
        background_color: "#FBF8F3",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,json}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      "@platform/config/tsconfig.base.json": platform(
        "config",
        "tsconfig.base.json",
      ),
      "@platform/config/tsconfig.react.json": platform(
        "config",
        "tsconfig.react.json",
      ),
      "@platform/config/tsconfig.node.json": platform(
        "config",
        "tsconfig.node.json",
      ),
      "@platform/config/vite-app-version": platform(
        "config",
        "vite-app-version.js",
      ),
      "@platform/runtime": platform("runtime", "src", "index.ts"),
      "@platform/ui": platform("ui", "src", "index.ts"),
      "@platform/animation": platform("animation", "src", "index.ts"),
      "@platform/site-registry/contract": platform(
        "site-registry",
        "src",
        "contract.ts",
      ),
      "@platform/math": platform("math", "src", "index.ts"),
      "@songara/pwa-base/preview/dexie": platform(
        "preview-dexie",
        "src",
        "index.ts",
      ),
    },
  },
  server: {
    host: true,
    port: 5305,
    strictPort: true,
    allowedHosts: [".dev.songara.uk"],
  },
});

import { execSync } from "node:child_process";
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

function gitInfo(field: "commit" | "branch"): string {
  try {
    const cmd =
      field === "commit"
        ? "git rev-parse --short HEAD"
        : "git rev-parse --abbrev-ref HEAD";
    return execSync(cmd, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

const gitCommit = gitInfo("commit");
const gitBranch = gitInfo("branch");

export default defineConfig({
  define: {
    "import.meta.env.VITE_GIT_COMMIT": JSON.stringify(gitCommit),
    "import.meta.env.VITE_GIT_BRANCH": JSON.stringify(gitBranch),
  },
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
        // Starter-pack JSON is ~1MB minified; default 2MiB is enough once it
        // is not inlined into the main JS chunk.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    // PWA-Base is compiled from sibling source. Without forcing one copy,
    // Vite resolves `react` from PWA-Base's pnpm store (e.g. 19.2.7) for
    // foundation modules and from Recipe's node_modules (e.g. 19.2.8) for
    // the app — production then ships multiple React copies and hooks fail
    // with "Cannot read properties of null (reading 'useState')".
    // Same pattern as the dexie alias below.
    dedupe: [
      "react",
      "react-dom",
      "react-router",
      "react-router-dom",
      "dexie",
      "dexie-react-hooks",
    ],
    alias: {
      "@": path.resolve(root, "./src"),
      react: path.resolve(root, "node_modules/react"),
      "react-dom": path.resolve(root, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(
        root,
        "node_modules/react/jsx-runtime.js",
      ),
      "react/jsx-dev-runtime": path.resolve(
        root,
        "node_modules/react/jsx-dev-runtime.js",
      ),
      // Do not alias `react-router` itself — it breaks `react-router/dom`
      // package exports. Dedupe + forcing `react-router-dom` is enough.
      "react-router-dom": path.resolve(
        root,
        "node_modules/react-router-dom",
      ),
      dexie: path.resolve(root, "node_modules/dexie"),
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
    // Dev site is reverse-proxied (Caddy HTTP → Vite). Without this, the client
    // tries ws://localhost:5305 from the public host and HMR fails.
    hmr: {
      host: "recipe.dev.songara.uk",
      protocol: "ws",
      clientPort: 80,
    },
  },
});

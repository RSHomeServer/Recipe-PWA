#!/usr/bin/env node
/**
 * Ensures the sibling PWA-Base worktree can resolve @platform/* when Vite
 * compiles foundation source (tsconfig extends). No-op when already linked.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(root, "..");
const pwaBase = path.resolve(appRoot, "../PWA-Base");
const platformConfig = path.join(pwaBase, "node_modules", "@platform", "config");

if (existsSync(platformConfig)) {
  process.exit(0);
}

console.log("PWA-Base @platform links missing — running pnpm install in sibling…");
const result = spawnSync("pnpm", ["install"], {
  cwd: pwaBase,
  stdio: "inherit",
});

process.exit(result.status ?? 1);

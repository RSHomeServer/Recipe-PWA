declare module "@songara/pwa-base" {
  import type { ReactNode } from "react";

  export interface SiteRoute {
    path: string;
    component: unknown;
  }

  export interface SiteDefinition {
    id: string;
    basePath: string;
    title: string;
    routes: readonly SiteRoute[];
    requiredPackIds?: readonly string[];
    capabilities?: readonly string[];
  }

  export const SITE_CAPABILITY: {
    readonly offline: "offline";
    readonly media: "media";
    readonly fullBleed: "full-bleed";
    readonly defaultTopbarCollapsed: "default-topbar-collapsed";
  };

  export function defineSite(site: SiteDefinition): SiteDefinition;

  export interface SoloSiteAppProps {
    site: SiteDefinition;
    nav?: unknown;
  }

  export function SoloSiteApp(props: SoloSiteAppProps): ReactNode;
}

declare module "@songara/pwa-base/contract" {
  export {
    defineSite,
    SITE_CAPABILITY,
    type SiteDefinition,
    type SiteRoute,
  } from "@songara/pwa-base";
}

declare module "@songara/pwa-base/ui" {
  import type { HTMLAttributes, ReactNode } from "react";

  export type ThemePreference = "light" | "dark" | "system";

  export interface ThemeProviderProps {
    children: ReactNode;
    defaultTheme?: ThemePreference;
  }

  export function ThemeProvider(props: ThemeProviderProps): ReactNode;

  export interface ThemeToggleProps {
    showLabels?: boolean;
    className?: string;
  }

  export function ThemeToggle(props: ThemeToggleProps): ReactNode;

  export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
    title: string;
    description?: string;
    media?: ReactNode;
    action?: ReactNode;
  }

  export function EmptyState(props: EmptyStateProps): ReactNode;

  export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
    size?: "sm" | "md" | "lg";
    label?: string;
  }

  export function Spinner(props: SpinnerProps): ReactNode;

  export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

  export function Skeleton(props: SkeletonProps): ReactNode;
}

declare module "@songara/pwa-base/ui/tokens.css" {}

declare module "@songara/pwa-base/config/vite-app-version" {
  export function appVersionPlugin(): { name: string };
}

declare module "@songara/pwa-base/preview/dexie" {
  export { default as Dexie } from "dexie";
  export type {
    EntityTable,
    IndexableType,
    PromiseExtended,
    Table,
    Transaction,
  } from "dexie";

  export type SongaraSchemaVersion = {
    version: number;
    stores: { [tableName: string]: string | null };
    upgrade?: (tx: import("dexie").Transaction) => Promise<void> | void;
  };

  export type CreateSongaraDbOptions = {
    name: string;
    versions: readonly SongaraSchemaVersion[];
  };

  export function createSongaraDb(
    options: CreateSongaraDbOptions,
  ): import("dexie").default;
  export function applySchemaVersions(
    db: import("dexie").default,
    versions: readonly SongaraSchemaVersion[],
  ): import("dexie").default;
  export function sortSchemaVersions(
    versions: readonly SongaraSchemaVersion[],
  ): SongaraSchemaVersion[];
  export function songaraDbName(appId: string, dbKey: string): string;
}

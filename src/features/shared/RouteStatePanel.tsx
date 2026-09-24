import { useEffect, useState } from "react";
import { EmptyState, Skeleton, Spinner } from "@songara/pwa-base/ui";
import type { ViewState, RouteStateConfig } from "@/features/shared/route-states";
import { Button } from "@/ui/button";

export type RouteStatePanelProps = {
  state: ViewState;
  config: RouteStateConfig;
  onRetry?: () => void;
  onAction?: () => void;
};

/**
 * Local IndexedDB reads are fast, so most loads never need a skeleton
 * (DESIGN.md §11). Delay the skeleton by ~150ms so a load that resolves
 * immediately never flashes one; a genuinely slow load still gets a
 * layout-matching placeholder rather than a blank panel.
 */
const SKELETON_DELAY_MS = 150;

/** True after `delayMs` from mount. Mounts only while loading, so no reset path. */
function useDelayedMount(delayMs: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  return shown;
}

function RouteLoadingSkeleton({ rows }: { rows: number }) {
  const showSkeleton = useDelayedMount(SKELETON_DELAY_MS);
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {showSkeleton
        ? Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))
        : null}
    </div>
  );
}

export function RouteStatePanel({
  state,
  config,
  onRetry,
  onAction,
}: RouteStatePanelProps) {
  if (state === "loading") {
    return <RouteLoadingSkeleton rows={config.loading.rows ?? 4} />;
  }

  if (state === "error") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-border bg-card p-6 space-y-4"
      >
        <h2 className="font-display text-xl font-semibold">{config.error.title}</h2>
        <p className="text-base text-muted-foreground">{config.error.description}</p>
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            {config.error.retryLabel ?? "Try again"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <EmptyState
      title={config.empty.title}
      description={config.empty.description}
      action={
        config.empty.actionLabel && onAction ? (
          <Button type="button" onClick={onAction}>
            {config.empty.actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

export function InlineSpinner({ label = "Loading" }: { label?: string }) {
  return <Spinner label={label} />;
}

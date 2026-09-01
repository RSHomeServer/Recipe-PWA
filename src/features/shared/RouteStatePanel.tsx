import { EmptyState, Spinner } from "@songara/pwa-base/ui";
import type { ViewState, RouteStateConfig } from "@/features/shared/route-states";
import { Button } from "@/ui/button";

export type RouteStatePanelProps = {
  state: ViewState;
  config: RouteStateConfig;
  onRetry?: () => void;
  onAction?: () => void;
};

export function RouteStatePanel({
  state,
  config,
  onRetry,
  onAction,
}: RouteStatePanelProps) {
  if (state === "loading") {
    const rows = config.loading.rows ?? 4;
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-12 w-full rounded-md bg-muted" />
        ))}
      </div>
    );
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

import { Link } from "react-router-dom";
import { useSettings } from "@/features/shopping/hooks";
import { servedGitTip } from "@/features/shared/servedGitTip";

/**
 * High-visibility banner for the git tip currently served by Vite.
 * Controlled by Settings.showDevTipBanner (default on).
 */
export function DevTipBanner() {
  const settings = useSettings();
  if (settings === undefined) return null;
  if (!settings.showDevTipBanner) return null;

  const { branch, commit } = servedGitTip();

  return (
    <div
      role="status"
      aria-label="Served development tip"
      className="sticky top-0 z-40 border-b-2 border-[var(--color-accent-hover)] bg-[var(--color-accent)] px-3 py-2.5 text-[var(--color-accent-foreground)] shadow-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold leading-snug tracking-tight sm:text-base">
          Serving tip{" "}
          <span className="font-mono font-bold underline decoration-2 underline-offset-2">
            {commit}
          </span>{" "}
          on{" "}
          <span className="font-mono font-bold">{branch}</span>
        </p>
        <Link
          to="/settings"
          className="shrink-0 rounded-md bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide underline-offset-2 hover:bg-black/30 hover:underline sm:text-sm"
        >
          Hide in Settings
        </Link>
      </div>
    </div>
  );
}

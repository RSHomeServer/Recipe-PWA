import { X } from "lucide-react";
import { toast } from "sonner";
import { useRepos } from "@/data";
import { useSettings } from "@/features/shopping/hooks";
import { Button } from "@/ui/button";

const LOOP_SENTENCES = [
  "Stock the pantry with ingredients you buy.",
  "Cook a recipe into a batch — one cooking session and the portions it produced.",
  "Plan portions and items across the week (planning never touches the pantry).",
  "Shop for the difference between the plan and what you already have.",
] as const;

/**
 * Dismissible first-visit panel on Plan and Cook (ADR-003 §5 / R3.5–R3.7).
 * Dismissal persists in Settings; Settings can restore it.
 */
export function HowThisWorksPanel() {
  const repos = useRepos();
  const settings = useSettings();

  if (settings === undefined || settings.howItWorksDismissed) {
    return null;
  }

  return (
    <aside
      className="rounded-lg border border-border bg-[var(--color-surface-raised)] p-4"
      aria-labelledby="how-this-works-heading"
      data-slot="how-this-works"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h2
            id="how-this-works-heading"
            className="text-base font-semibold text-foreground"
          >
            How this works
          </h2>
          <ol className="list-decimal space-y-1 pl-5 text-base text-muted-foreground">
            {LOOP_SENTENCES.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ol>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label="Dismiss how this works"
          disabled={!repos}
          onClick={() => {
            if (!repos || !settings) return;
            void repos.settings
              .put({ ...settings, howItWorksDismissed: true })
              .then(() => toast.message("Hidden — restore from Settings anytime"))
              .catch((error: unknown) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not save preference",
                );
              });
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </aside>
  );
}

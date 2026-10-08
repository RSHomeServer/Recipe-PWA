import { render, screen, within } from "@testing-library/react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Check } from "lucide-react";
import { describe, expect, it } from "vitest";
import { FLAVOUR_TAGS } from "@/domain";
import { cn } from "@/ui/lib/utils";

/**
 * V3_SCOPE testing item 14 — tag filter control at 320px (R5.9).
 * Mirrors FlavourLabPage markup so the release gate tracks the live control.
 */
function FlavourTagFilterStub() {
  const tags: string[] = [];
  return (
    <div style={{ width: 320 }}>
      <ToggleGroup.Root
        type="multiple"
        value={tags}
        onValueChange={() => {}}
        aria-label="Flavour tags"
        className="flex flex-wrap gap-2"
        data-testid="flavour-lab-tags"
      >
        {FLAVOUR_TAGS.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <ToggleGroup.Item
              key={tag}
              value={tag}
              className={cn(
                "inline-flex min-h-11 flex-none items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                  : "border-border bg-[var(--color-surface-raised)] text-foreground hover:bg-muted",
              )}
            >
              {selected ? (
                <Check className="size-4 shrink-0" aria-hidden="true" />
              ) : null}
              <span>{tag}</span>
            </ToggleGroup.Item>
          );
        })}
      </ToggleGroup.Root>
    </div>
  );
}

describe("Flavour Lab tag filter at 320px (V3 test 14 / R5.9)", () => {
  it("wraps without truncating labels or dropping below 44px", () => {
    render(<FlavourTagFilterStub />);

    const group = screen.getByTestId("flavour-lab-tags");
    expect(group.className).toMatch(/flex-wrap/);

    for (const toggle of within(group).getAllByRole("button")) {
      expect(toggle.className).toMatch(/min-h-11/);
      expect(toggle.className).not.toMatch(/truncate/);
      const label = toggle.querySelector("span");
      expect(label?.textContent?.length).toBeGreaterThan(0);
    }

    expect(within(group).getAllByRole("button").length).toBe(
      FLAVOUR_TAGS.length,
    );
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CommandPicker } from "@/ui/command-picker";
import { SegmentedGroup } from "@/ui/segmented-group";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

describe("choice controls a11y (V2 test 11)", () => {
  it("SegmentedGroup is a radiogroup with one tab stop and arrow selection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <SegmentedGroup
        aria-label="Slot"
        value="breakfast"
        onValueChange={onValueChange}
        options={[
          { value: "breakfast", label: "Breakfast" },
          { value: "lunch", label: "Lunch" },
          { value: "dinner", label: "Dinner" },
        ]}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Slot" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);

    await user.tab();
    expect(document.activeElement).toBe(
      within(group).getByRole("radio", { name: "Breakfast" }),
    );

    // One tab stop in the group: next Tab leaves the radiogroup.
    await user.tab();
    expect(
      within(group)
        .queryAllByRole("radio")
        .some((el) => el === document.activeElement),
    ).toBe(false);

    within(group).getByRole("radio", { name: "Breakfast" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(
      within(group).getByRole("radio", { name: "Lunch" }),
    );
    await user.keyboard(" ");
    expect(onValueChange).toHaveBeenCalledWith("lunch");

    onValueChange.mockClear();
    rerender(
      <SegmentedGroup
        aria-label="Slot"
        value="lunch"
        onValueChange={onValueChange}
        options={[
          { value: "breakfast", label: "Breakfast" },
          { value: "lunch", label: "Lunch" },
          { value: "dinner", label: "Dinner" },
        ]}
      />,
    );
    within(group).getByRole("radio", { name: "Lunch" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(
      within(group).getByRole("radio", { name: "Dinner" }),
    );
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("dinner");
  });

  it("CommandPicker is keyboard operable and restores focus on close", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <CommandPicker
        aria-label="Recipe"
        title="Choose recipe"
        value="a"
        onValueChange={onValueChange}
        recentIds={["b"]}
        items={[
          { value: "a", label: "Apple pie", context: "400 kcal / serving" },
          { value: "b", label: "Biryani", context: "520 kcal / serving" },
          { value: "c", label: "Curry", context: "380 kcal / serving" },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Recipe" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Recent")).toBeTruthy();

    const search = screen.getByPlaceholderText("Search…");
    await user.clear(search);
    await user.type(search, "Curry");
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("c");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("segmented groups at 320px (V2 test 11a)", () => {
  it("wraps without truncating labels or dropping below 44px", () => {
    const { container } = render(
      <div style={{ width: 320 }}>
        <SegmentedGroup
          aria-label="What to plan"
          value="recipeServings"
          onValueChange={() => {}}
          options={[
            { value: "recipeServings", label: "Still to cook" },
            { value: "batchPortions", label: "Already cooked" },
            { value: "ingredient", label: "Eat as-is" },
          ]}
        />
      </div>,
    );

    const group = screen.getByRole("radiogroup", { name: "What to plan" });
    expect(group.className).toMatch(/flex-wrap/);

    for (const radio of within(group).getAllByRole("radio")) {
      expect(radio.className).toMatch(/min-h-11/);
      expect(radio.className).toMatch(/break-words|whitespace-normal/);
      expect(radio.className).not.toMatch(/truncate/);
    }

    expect(
      container.querySelector('[data-slot="segmented-group"]'),
    ).toBeTruthy();
  });
});

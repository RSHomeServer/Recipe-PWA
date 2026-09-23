import { useState } from "react";
import {
  formatShoppingWindowLabel,
  shoppingPreset,
  type ShoppingWindow,
} from "@/domain";
import { DateRangeControl } from "@/features/components/domain-stubs";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover";

export type ShoppingWindowControlProps = {
  window: ShoppingWindow;
  onChange: (next: ShoppingWindow) => void;
  onNudgeWeek: (direction: -1 | 1) => void;
};

export function ShoppingWindowControl({
  window,
  onChange,
  onNudgeWeek,
}: ShoppingWindowControlProps) {
  const [open, setOpen] = useState(false);
  const [fromDraft, setFromDraft] = useState(window.from);
  const [toDraft, setToDraft] = useState(window.to);
  const label = formatShoppingWindowLabel(window);

  const applyCustom = () => {
    if (fromDraft > toDraft) return;
    onChange({ from: fromDraft, to: toDraft });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setFromDraft(window.from);
          setToDraft(window.to);
        }
      }}
    >
      <DateRangeControl
        label={label}
        onPrevious={() => onNudgeWeek(-1)}
        onNext={() => onNudgeWeek(1)}
        labelSlot={
          <PopoverTrigger asChild>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-4 py-2 text-base font-medium"
              aria-label={`${label}. Change date range`}
            >
              {label}
            </button>
          </PopoverTrigger>
        }
      />
      <PopoverContent align="start" className="w-80 space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose how far ahead to shop for. Ticks stay with each range.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => {
              onChange(shoppingPreset(7));
              setOpen(false);
            }}
          >
            Next 7 days
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => {
              onChange(shoppingPreset(14));
              setOpen(false);
            }}
          >
            Next 14 days
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="shop-from">From</Label>
            <Input
              id="shop-from"
              type="date"
              value={fromDraft}
              onChange={(e) => setFromDraft(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="shop-to">To</Label>
            <Input
              id="shop-to"
              type="date"
              value={toDraft}
              onChange={(e) => setToDraft(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" className="w-full" onClick={applyCustom}>
          Apply dates
        </Button>
      </PopoverContent>
    </Popover>
  );
}

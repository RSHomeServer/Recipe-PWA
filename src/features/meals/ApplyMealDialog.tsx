import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRepos } from "@/data";
import {
  formatDayCompact,
  type IsoDate,
  type MealSlot,
  type MealTemplate,
} from "@/domain";
import { applyMealTemplate } from "@/features/meals/commands";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { Label } from "@/ui/label";
import { SegmentedGroup } from "@/ui/segmented-group";
import { cn } from "@/ui/lib/utils";

export type ApplyMealDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: MealTemplate;
  days: readonly IsoDate[];
  slots: MealSlot[];
  initialSlotId?: string;
  initialDates?: readonly IsoDate[];
};

function ApplyMealDialogBody({
  template,
  days,
  slots,
  initialSlotId,
  initialDates,
  onOpenChange,
}: Omit<ApplyMealDialogProps, "open">) {
  const repos = useRepos();
  const defaultSlot =
    template.defaultSlotId ??
    initialSlotId ??
    slots.find((s) => s.isDefault)?.id ??
    slots[0]?.id ??
    "";
  const [slotId, setSlotId] = useState(defaultSlot);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialDates ?? days.slice(0, 1)),
  );
  const [busy, setBusy] = useState(false);

  const slotOptions = useMemo(
    () => slots.map((s) => ({ value: s.id, label: s.name })),
    [slots],
  );

  const toggleDay = (date: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const onApply = async () => {
    if (!repos) {
      toast.error("Data is not ready yet");
      return;
    }
    if (!slotId) {
      toast.error("Pick a slot");
      return;
    }
    const dates = days.filter((d) => selected.has(d));
    if (dates.length === 0) {
      toast.error("Select at least one day");
      return;
    }
    setBusy(true);
    try {
      const rows = await applyMealTemplate(repos, {
        template,
        dates,
        slotId,
      });
      toast.success(
        `Applied to ${dates.length} day${dates.length === 1 ? "" : "s"} (${rows.length} plan rows)`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not apply meal",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader className="border-b border-border px-4 py-3 pr-12">
        <DialogTitle>Apply “{template.name}”</DialogTitle>
        <DialogDescription>
          Tick the days you want this meal on. Each day gets one plan row per
          component, grouped together.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-2">
          <Label id="apply-slot-label">Slot</Label>
          <SegmentedGroup
            id="apply-slot"
            aria-labelledby="apply-slot-label"
            value={slotId}
            onValueChange={setSlotId}
            options={slotOptions}
          />
        </div>

        <div className="space-y-2">
          <Label>Days</Label>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label="Days to apply"
          >
            {days.map((date) => {
              const checked = selected.has(date);
              return (
                <button
                  key={date}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleDay(date)}
                  className={cn(
                    "min-h-11 rounded-md border px-2 py-2 text-sm transition-colors",
                    checked
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {formatDayCompact(date)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set(days))}
            >
              All days
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter className="border-t border-border px-4 py-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="button" disabled={busy} onClick={() => void onApply()}>
          Apply meal
        </Button>
      </DialogFooter>
    </>
  );
}

export function ApplyMealDialog({
  open,
  onOpenChange,
  template,
  days,
  slots,
  initialSlotId,
  initialDates,
}: ApplyMealDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0">
        {open ? (
          <ApplyMealDialogBody
            key={`${template.id}:${days.join(",")}`}
            template={template}
            days={days}
            slots={slots}
            initialSlotId={initialSlotId}
            initialDates={initialDates}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

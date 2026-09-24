import { ChevronsUpDown } from "lucide-react";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import { cn } from "@/ui/lib/utils";

export type CommandPickerItem = {
  value: string;
  label: string;
  /** Extra search tokens. */
  keywords?: string[];
  disabled?: boolean;
  disabledReason?: string;
  /** Secondary facts shown beside / under the label (R5.7). */
  context?: ReactNode;
};

export type CommandPickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  items: readonly CommandPickerItem[];
  /** Values pinned under “Recent” before any query (R5.6). */
  recentIds?: readonly string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * Cardinality >15 or unbounded (ADR-005 / R5.6–R5.8).
 * shadcn Command inside Dialog; bottom sheet under md.
 */
export function CommandPicker({
  value,
  onValueChange,
  items,
  recentIds = [],
  placeholder = "Choose…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  title = "Choose",
  description,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: CommandPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const byId = useMemo(() => {
    const map = new Map<string, CommandPickerItem>();
    for (const item of items) map.set(item.value, item);
    return map;
  }, [items]);

  const selected = byId.get(value);
  const triggerText = selected?.label ?? placeholder;

  const recentItems = useMemo(() => {
    if (query.trim()) return [];
    const seen = new Set<string>();
    const out: CommandPickerItem[] = [];
    for (const id of recentIds) {
      if (seen.has(id)) continue;
      const item = byId.get(id);
      if (!item) continue;
      seen.add(id);
      out.push(item);
    }
    return out;
  }, [recentIds, byId, query]);

  const recentSet = useMemo(
    () => new Set(recentItems.map((item) => item.value)),
    [recentItems],
  );

  const catalogItems = useMemo(() => {
    if (!query.trim()) {
      return items.filter((item) => !recentSet.has(item.value));
    }
    return items;
  }, [items, recentSet, query]);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    setQuery("");
    queueMicrotask(() => triggerRef.current?.focus());
  };

  const selectItem = (next: string) => {
    const item = byId.get(next);
    if (!item || item.disabled) return;
    onValueChange(next);
    closeAndRestoreFocus();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closeAndRestoreFocus();
          return;
        }
        setOpen(true);
      }}
    >
      <Button
        ref={triggerRef}
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "h-11 w-full justify-between gap-2 font-normal",
          !selected && "text-muted-foreground",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0 truncate text-left">{triggerText}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
      </Button>

      <DialogContent
        showClose
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="gap-0 overflow-hidden p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle id={titleId}>{title}</DialogTitle>
          {description ? (
            <DialogDescription id={descriptionId}>
              {description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only" id={descriptionId}>
              Search and select an option. Use arrow keys to move, Enter to
              choose, Escape to close.
            </DialogDescription>
          )}
        </DialogHeader>

        <Command
          shouldFilter
          filter={(value, search, keywords) => {
            const hay = `${value} ${(keywords ?? []).join(" ")}`.toLowerCase();
            const needle = search.trim().toLowerCase();
            if (!needle) return 1;
            return hay.includes(needle) ? 1 : 0;
          }}
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            autoFocus
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {recentItems.length > 0 ? (
              <CommandGroup heading="Recent">
                {recentItems.map((item) => (
                  <PickerRow
                    key={`recent-${item.value}`}
                    item={item}
                    onSelect={selectItem}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {catalogItems.length > 0 ? (
              <CommandGroup heading={recentItems.length > 0 ? "All" : undefined}>
                {catalogItems.map((item) => (
                  <PickerRow
                    key={item.value}
                    item={item}
                    onSelect={selectItem}
                  />
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function PickerRow({
  item,
  onSelect,
}: {
  item: CommandPickerItem;
  onSelect: (value: string) => void;
}) {
  const name = item.disabled
    ? `${item.label}${item.disabledReason ? ` — ${item.disabledReason}` : ""}`
    : item.label;

  return (
    <CommandItem
      value={item.label}
      keywords={item.keywords}
      disabled={item.disabled}
      onSelect={() => onSelect(item.value)}
      aria-label={name}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{item.label}</span>
        {item.context ? (
          <span className="text-sm text-muted-foreground">{item.context}</span>
        ) : null}
      </div>
    </CommandItem>
  );
}

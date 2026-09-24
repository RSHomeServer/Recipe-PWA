import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { useMealTemplates } from "@/features/meals/hooks";
import { useRecipeData } from "@/data";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { cn } from "@/ui/lib/utils";

const listStateConfig = {
  empty: {
    title: "No meals saved yet.",
    description:
      "Save a combination you eat often — then apply it to several days at once.",
    actionLabel: "Create meal",
  },
  loading: { rows: 4 },
  error: {
    title: "Could not load meals",
    description: "Your meals are stored locally on this device.",
  },
} as const;

export default function MealsPage() {
  const navigate = useNavigate();
  const { ready, error: dataError } = useRecipeData();
  const templates = useMealTemplates();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    if (!templates) return undefined;
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      if (!showArchived && template.archivedAt != null) return false;
      if (needle && !template.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [templates, query, showArchived]);

  if (dataError) {
    return (
      <div className="app-page content">
        <PageHeader
          title="Meals"
          description="Saved combinations you apply to the plan."
        />
        <RouteStatePanel state="error" config={listStateConfig} />
      </div>
    );
  }

  if (!ready || templates === undefined || filtered === undefined) {
    return (
      <div className="app-page content">
        <PageHeader
          title="Meals"
          description="Saved combinations you apply to the plan."
        />
        <RouteStatePanel state="loading" config={listStateConfig} />
      </div>
    );
  }

  return (
    <div className="app-page content space-y-6">
      <PageHeader
        title="Meals"
        description="Saved combinations you apply to several days at once. Editing a meal does not change plans already made."
        actions={
          <Button type="button" onClick={() => void navigate("/meals/new")}>
            <Plus className="size-4" aria-hidden="true" />
            Create meal
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1 space-y-2">
          <Label htmlFor="meal-search">Search</Label>
          <Input
            id="meal-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name"
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {filtered.length === 0 ? (
        <RouteStatePanel
          state="empty"
          config={listStateConfig}
          onAction={() => void navigate("/meals/new")}
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {filtered.map((template) => (
            <li key={template.id}>
              <Link
                to={`/meals/${template.id}`}
                className={cn(
                  "flex min-h-14 items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/40",
                  template.archivedAt != null && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{template.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {template.components.length} component
                    {template.components.length === 1 ? "" : "s"}
                    {template.archivedAt != null ? " · Archived" : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useRecipeData, useRepos } from "@/data";
import {
  createId,
  eachDateInRange,
  todayIso,
  weekContaining,
  type MealTemplate,
} from "@/domain";
import { ApplyMealDialog } from "@/features/meals/ApplyMealDialog";
import { MealTemplateForm } from "@/features/meals/MealTemplateForm";
import { useMealTemplate } from "@/features/meals/hooks";
import type { SaveAsMealLocationState } from "@/features/meals/save-as-meal-state";
import {
  useIngredientsForPlan,
  useMealSlots,
  useRecipesForPlan,
} from "@/features/plan/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { Button } from "@/ui/button";

const stateConfig = {
  empty: { title: "Meal not found." },
  loading: { rows: 4 },
  error: {
    title: "Could not load meal",
    description: "Your meals are stored locally on this device.",
  },
} as const;

export default function MealTemplateDetailPage() {
  const { id } = useParams();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const location = useLocation();
  const saveAsMeal = (location.state as SaveAsMealLocationState | null)
    ?.saveAsMeal;
  const { ready, error: dataError } = useRecipeData();
  const repos = useRepos();
  const existing = useMealTemplate(isNew ? undefined : id);
  const recipes = useRecipesForPlan();
  const ingredients = useIngredientsForPlan();
  const slots = useMealSlots();
  const [busy, setBusy] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const weekDays = useMemo(
    () => eachDateInRange(weekContaining(todayIso(), 1)),
    [],
  );

  const prefillInitial = useMemo((): MealTemplate | undefined => {
    if (!isNew || !saveAsMeal?.components.length) return undefined;
    const now = new Date().toISOString();
    return {
      id: createId(),
      name: "",
      components: saveAsMeal.components,
      defaultSlotId: saveAsMeal.defaultSlotId,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
  }, [isNew, saveAsMeal]);

  const loading =
    !ready ||
    recipes === undefined ||
    ingredients === undefined ||
    slots === undefined ||
    (!isNew && existing === undefined);

  if (dataError) {
    return (
      <div className="app-page content">
        <PageHeader title={isNew ? "New meal" : "Edit meal"} />
        <RouteStatePanel state="error" config={stateConfig} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-page content">
        <PageHeader title={isNew ? "New meal" : "Edit meal"} />
        <RouteStatePanel state="loading" config={stateConfig} />
      </div>
    );
  }

  if (!isNew && existing === null) {
    return (
      <div className="app-page content">
        <PageHeader title="Edit meal" />
        <RouteStatePanel state="empty" config={stateConfig} />
      </div>
    );
  }

  const save = async (template: MealTemplate) => {
    if (!repos) {
      toast.error("Data is not ready yet");
      return;
    }
    setBusy(true);
    try {
      await repos.mealTemplates.put(template);
      toast.success(isNew ? "Meal created" : "Meal saved");
      void navigate(isNew ? `/meals/${template.id}` : "/meals");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save meal",
      );
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!repos || !existing) return;
    setBusy(true);
    try {
      await repos.mealTemplates.archive(existing.id, new Date().toISOString());
      toast.success("Meal archived");
      void navigate("/meals");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not archive meal",
      );
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!repos || !existing) return;
    setBusy(true);
    try {
      await repos.mealTemplates.put({ ...existing, archivedAt: null });
      toast.success("Meal restored");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not restore meal",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-page content space-y-6">
      <PageHeader
        title={isNew ? "New meal" : existing!.name}
        description="A meal expands into ordinary plan rows — shopping and insights stay unchanged."
        actions={
          !isNew && existing?.archivedAt == null ? (
            <Button type="button" onClick={() => setApplyOpen(true)}>
              Apply to plan
            </Button>
          ) : undefined
        }
      />
      <MealTemplateForm
        recipes={recipes}
        ingredients={ingredients}
        slots={slots}
        initial={isNew ? prefillInitial : existing!}
        submitting={busy}
        onSubmit={save}
        onArchive={!isNew && existing?.archivedAt == null ? archive : undefined}
        onRestore={!isNew && existing?.archivedAt != null ? restore : undefined}
        onCancel={() => void navigate("/meals")}
      />
      {!isNew && existing ? (
        <ApplyMealDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          template={existing}
          days={weekDays}
          slots={slots}
          initialSlotId={existing.defaultSlotId ?? slots[0]?.id}
          initialDates={weekDays}
        />
      ) : null}
    </div>
  );
}

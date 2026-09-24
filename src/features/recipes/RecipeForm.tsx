import { useEffect, useMemo, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  RecipeFormSchema,
  buildRecipeFields,
  createId,
  draftsToRecipeInput,
  emptyRecipeFormValues,
  mergeLineDrafts,
  newLineDraft,
  recipeToFormValues,
  resizeRecipeImage,
  unitsForKind,
  type BuiltRecipeFields,
  type Ingredient,
  type Recipe,
  type RecipeFormParsed,
  type RecipeFormValues,
  type RecipeImage,
  type Unit,
} from "@/domain";
import { RecipeNutritionPanel } from "@/features/recipes/RecipeNutritionPanel";
import { Button } from "@/ui/button";
import { CommandPicker } from "@/ui/command-picker";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  readPickerRecents,
  rememberPickerRecent,
} from "@/ui/picker-recents";
import { Textarea } from "@/ui/textarea";
import { UnitChoice } from "@/ui/unit-choice";

export type RecipeFormProps = {
  activeIngredients: Ingredient[];
  ingredientsById: ReadonlyMap<string, Ingredient>;
  initial?: Recipe;
  existingImageUrl?: string | null;
  submitting?: boolean;
  onSubmit: (payload: {
    fields: BuiltRecipeFields;
    image: RecipeImage | null;
    removeImage: boolean;
  }) => Promise<void>;
  onArchive?: () => Promise<void>;
  onRestore?: () => Promise<void>;
  onCancel: () => void;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-[var(--color-error)]" role="alert">
      {message}
    </p>
  );
}

export function RecipeForm({
  activeIngredients,
  ingredientsById,
  initial,
  existingImageUrl,
  submitting = false,
  onSubmit,
  onArchive,
  onRestore,
  onCancel,
}: RecipeFormProps) {
  const form = useForm<RecipeFormValues, unknown, RecipeFormParsed>({
    resolver: zodResolver(RecipeFormSchema),
    defaultValues: initial
      ? recipeToFormValues(initial)
      : emptyRecipeFormValues(),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  const {
    fields: lineFields,
    append,
    remove,
    update,
  } = useFieldArray({ control, name: "lines" });

  const [scaleOverride, setScaleOverride] = useState<number | null>(null);
  const [pickerId, setPickerId] = useState("");
  const [ingredientRecents, setIngredientRecents] = useState(() =>
    readPickerRecents("ingredients"),
  );
  const [pendingImage, setPendingImage] = useState<RecipeImage | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial) {
      reset(emptyRecipeFormValues());
      return;
    }
    reset(recipeToFormValues(initial));
  }, [initial, reset]);

  const watchedName = useWatch({ control, name: "name" }) ?? "";
  const watchedServings = useWatch({ control, name: "servings" }) ?? 1;
  const watchedLinesRaw = useWatch({ control, name: "lines" });
  const watchedLines = useMemo(
    () => watchedLinesRaw ?? [],
    [watchedLinesRaw],
  );
  const watchedSteps = useWatch({ control, name: "steps" }) ?? [""];

  const scaleServings =
    scaleOverride ?? (watchedServings > 0 ? watchedServings : 1);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const previewRecipe = useMemo(
    () =>
      draftsToRecipeInput(
        watchedName,
        Number(watchedServings) || 1,
        watchedLines,
        ingredientsById,
      ),
    [watchedName, watchedServings, watchedLines, ingredientsById],
  );

  const usedIngredientIds = useMemo(
    () => new Set(watchedLines.map((line) => line.ingredientId)),
    [watchedLines],
  );

  const pickerOptions = activeIngredients.filter(
    (ingredient) => !usedIngredientIds.has(ingredient.id),
  );

  const busy = submitting || isSubmitting;
  const isArchived = initial?.archivedAt != null;
  const showImage =
    pendingPreviewUrl ??
    (removeImage ? null : (existingImageUrl ?? null));

  const addIngredientLine = () => {
    if (!pickerId) return;
    const ingredient = ingredientsById.get(pickerId);
    if (!ingredient || ingredient.archivedAt != null) return;

    const draft = newLineDraft(ingredient.id, ingredient.measureKind);
    draft.amount = ingredient.measureKind === "count" ? 1 : 100;

    const existingIndex = watchedLines.findIndex(
      (line) => line.ingredientId === ingredient.id,
    );
    if (existingIndex >= 0) {
      const existing = getValues(`lines.${existingIndex}`);
      update(
        existingIndex,
        mergeLineDrafts(existing, draft, ingredient.measureKind),
      );
      toast.message(`Added more ${ingredient.name} to the existing line`);
    } else {
      append(draft);
    }
    setPickerId("");
  };

  const setStepAt = (index: number, value: string) => {
    const next = [...watchedSteps];
    next[index] = value;
    setValue("steps", next, { shouldDirty: true });
  };

  const addStep = () => {
    setValue("steps", [...watchedSteps, ""], { shouldDirty: true });
  };

  const removeStepAt = (index: number) => {
    if (watchedSteps.length <= 1) {
      setValue("steps", [""], { shouldDirty: true });
      return;
    }
    setValue(
      "steps",
      watchedSteps.filter((_, i) => i !== index),
      { shouldDirty: true },
    );
  };

  const onImageSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    try {
      const resized = await resizeRecipeImage(file);
      const image: RecipeImage = {
        id: createId(),
        blob: resized.blob,
        width: resized.width,
        height: resized.height,
      };
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingImage(image);
      setPendingPreviewUrl(URL.createObjectURL(resized.blob));
      setRemoveImage(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not process image",
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearImage = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingImage(null);
    setPendingPreviewUrl(null);
    setRemoveImage(true);
  };

  const nameErrorId = "recipe-name-error";
  const servingsErrorId = "recipe-servings-error";

  return (
    <form
      className="space-y-8"
      onSubmit={handleSubmit(async (values) => {
        const built = buildRecipeFields(values, ingredientsById);
        if (!built.ok) {
          toast.error(built.errors[0]?.message ?? "Could not save recipe");
          return;
        }
        try {
          await onSubmit({
            fields: built.fields,
            image: pendingImage,
            removeImage: removeImage && !pendingImage,
          });
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Could not save recipe",
          );
        }
      })}
      noValidate
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="recipe-name">Name (required)</Label>
            <Input
              id="recipe-name"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? nameErrorId : undefined}
              {...register("name")}
            />
            <FieldError id={nameErrorId} message={errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe-servings">Servings (required)</Label>
            <Input
              id="recipe-servings"
              type="number"
              inputMode="decimal"
              min={0.1}
              step="any"
              aria-invalid={errors.servings ? true : undefined}
              aria-describedby={errors.servings ? servingsErrorId : undefined}
              {...register("servings", { valueAsNumber: true })}
            />
            <FieldError
              id={servingsErrorId}
              message={errors.servings?.message}
            />
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Ingredients</h2>
              <p className="text-sm text-muted-foreground">
                Quantities use each ingredient&apos;s measure family. Duplicate
                picks merge into one line.
              </p>
            </div>

            {activeIngredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active ingredients yet.{" "}
                <Link
                  to="/ingredients/new"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Add ingredients
                </Link>{" "}
                first.
              </p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label id="recipe-add-ingredient-label">Add ingredient</Label>
                  <CommandPicker
                    id="recipe-add-ingredient"
                    aria-labelledby="recipe-add-ingredient-label"
                    title="Choose ingredient"
                    placeholder="Choose ingredient…"
                    value={pickerId}
                    onValueChange={(id) => {
                      setPickerId(id);
                      setIngredientRecents(
                        rememberPickerRecent("ingredients", id),
                      );
                    }}
                    recentIds={ingredientRecents}
                    items={pickerOptions.map((ingredient) => ({
                      value: ingredient.id,
                      label: ingredient.name,
                      context: ingredient.measureKind,
                    }))}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!pickerId || busy}
                  onClick={addIngredientLine}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
            )}

            {lineFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No ingredients on this recipe yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {lineFields.map((field, index) => {
                  const ingredient = ingredientsById.get(
                    watchedLines[index]?.ingredientId ?? field.ingredientId,
                  );
                  const units: Unit[] = ingredient
                    ? unitsForKind(ingredient.measureKind)
                    : [];
                  return (
                    <li
                      key={field.id}
                      className="space-y-3 border-t border-border pt-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">
                          {ingredient?.name ?? "Unknown ingredient"}
                          {watchedLines[index]?.optional ? (
                            <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Optional
                            </span>
                          ) : null}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${ingredient?.name ?? "line"}`}
                          disabled={busy}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                      <input
                        type="hidden"
                        {...register(`lines.${index}.id`)}
                      />
                      <input
                        type="hidden"
                        {...register(`lines.${index}.ingredientId`)}
                      />
                      <div className="grid gap-3 sm:grid-cols-[1fr_7rem_auto]">
                        <div className="space-y-2">
                          <Label htmlFor={`recipe-line-amount-${index}`}>
                            Quantity
                          </Label>
                          <Input
                            id={`recipe-line-amount-${index}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            {...register(`lines.${index}.amount`, {
                              valueAsNumber: true,
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label id={`recipe-line-unit-${index}-label`}>
                            Unit
                          </Label>
                          <Controller
                            control={control}
                            name={`lines.${index}.displayUnit`}
                            render={({ field: unitField }) => (
                              <UnitChoice
                                id={`recipe-line-unit-${index}`}
                                aria-labelledby={`recipe-line-unit-${index}-label`}
                                units={units}
                                value={unitField.value}
                                onValueChange={(unit) =>
                                  unitField.onChange(unit)
                                }
                              />
                            )}
                          />
                        </div>
                        <label className="flex min-h-11 items-end gap-2 pb-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-4 rounded border border-input"
                            {...register(`lines.${index}.optional`)}
                          />
                          Optional
                        </label>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`recipe-line-note-${index}`}>
                          Line note
                        </Label>
                        <Input
                          id={`recipe-line-note-${index}`}
                          placeholder="e.g. finely diced"
                          {...register(`lines.${index}.note`)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Steps</h2>
            <ul className="space-y-3">
              {watchedSteps.map((step, index) => (
                <li key={`step-${index}`} className="flex gap-2">
                  <span
                    className="mt-3 num w-6 shrink-0 text-sm text-muted-foreground"
                    aria-hidden="true"
                  >
                    {index + 1}.
                  </span>
                  <Textarea
                    rows={2}
                    aria-label={`Step ${index + 1}`}
                    value={step}
                    onChange={(event) => setStepAt(index, event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    aria-label={`Remove step ${index + 1}`}
                    disabled={busy || watchedSteps.length <= 1}
                    onClick={() => removeStepAt(index)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={addStep}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add step
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe-tags">Tags</Label>
            <Input
              id="recipe-tags"
              placeholder="Comma-separated, e.g. dinner, batch"
              {...register("tagsText")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe-notes">Notes</Label>
            <Textarea id="recipe-notes" rows={3} {...register("notes")} />
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Photo (optional)</h2>
            <p className="text-sm text-muted-foreground">
              Uploaded only in the editor. Cropped to 4:3 and resized; never
              required for layout.
            </p>
            {showImage ? (
              <img
                src={showImage}
                alt={watchedName.trim() || "Recipe"}
                className="aspect-[4/3] w-full max-w-md rounded-[var(--radius-md)] object-cover"
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                id="recipe-image-input"
                onChange={(event) => {
                  void onImageSelected(event.target.files?.[0]);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {showImage ? "Replace photo" : "Add photo"}
              </Button>
              {showImage ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={clearImage}
                >
                  Remove photo
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          {previewRecipe ? (
            <RecipeNutritionPanel
              recipe={previewRecipe}
              ingredientsById={ingredientsById}
              scaleServings={scaleServings > 0 ? scaleServings : undefined}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Fix ingredient units to preview nutrition.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="recipe-scale-preview">
              Scale preview (servings)
            </Label>
            <Input
              id="recipe-scale-preview"
              type="number"
              inputMode="decimal"
              min={0.1}
              step="any"
              value={scaleServings}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === "") {
                  setScaleOverride(null);
                  return;
                }
                const next = Number(raw);
                if (Number.isFinite(next)) setScaleOverride(next);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Preview only — does not create a second recipe.
            </p>
          </div>
        </aside>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {initial && !isArchived && onArchive ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void onArchive().catch((err: unknown) => {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Could not archive recipe",
                  );
                });
              }}
            >
              Archive
            </Button>
          ) : null}
          {initial && isArchived && onRestore ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void onRestore().catch((err: unknown) => {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Could not restore recipe",
                  );
                });
              }}
            >
              Restore
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {initial ? "Save changes" : "Create recipe"}
          </Button>
        </div>
      </div>
    </form>
  );
}

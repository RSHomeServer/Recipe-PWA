import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createId,
  emptyIngredientFormValues,
  hasDivergedFromReference,
  IngredientFormSchema,
  nutritionBasisLabel,
  resizeRecipeImage,
  type Ingredient,
  type IngredientCategory,
  type IngredientFormParsed,
  type IngredientFormValues,
  type MeasureKind,
  type RecipeImage,
} from "@/domain";
import { IngredientIdentity } from "@/features/ingredients/IngredientIdentity";
import { Button } from "@/ui/button";
import { Choice } from "@/ui/choice";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { SegmentedGroup } from "@/ui/segmented-group";
import { Textarea } from "@/ui/textarea";

const MEASURE_KIND_OPTIONS: {
  value: MeasureKind;
  label: string;
  helperText: string;
}[] = [
  {
    value: "mass",
    label: "Mass",
    helperText: "Quantities in grams or kilograms.",
  },
  {
    value: "volume",
    label: "Volume",
    helperText: "Quantities in millilitres or litres.",
  },
  {
    value: "count",
    label: "Count",
    helperText: "Quantities as whole or fractional items.",
  },
];

export type IngredientFormProps = {
  categories: IngredientCategory[];
  initial?: Ingredient;
  existingImageUrl?: string | null;
  measureKindLocked: boolean;
  submitting?: boolean;
  onSubmit: (payload: {
    values: IngredientFormParsed;
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

export function IngredientForm({
  categories,
  initial,
  existingImageUrl,
  measureKindLocked,
  submitting = false,
  onSubmit,
  onArchive,
  onRestore,
  onCancel,
}: IngredientFormProps) {
  const form = useForm<IngredientFormValues, unknown, IngredientFormParsed>({
    resolver: zodResolver(IngredientFormSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          categoryId: initial.categoryId,
          measureKind: initial.measureKind,
          nutrition: { ...initial.nutrition },
          notes: initial.notes ?? "",
        }
      : emptyIngredientFormValues(),
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (!initial) {
      reset(emptyIngredientFormValues());
      return;
    }
    reset({
      name: initial.name,
      categoryId: initial.categoryId,
      measureKind: initial.measureKind,
      nutrition: { ...initial.nutrition },
      notes: initial.notes ?? "",
    });
  }, [initial, reset]);

  const [pendingImage, setPendingImage] = useState<RecipeImage | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const measureKind = useWatch({ control, name: "measureKind" }) ?? "mass";
  const watchedCategoryId = useWatch({ control, name: "categoryId" });
  const watchedName = useWatch({ control, name: "name" }) ?? "";
  const basisLabel = nutritionBasisLabel(measureKind);
  const selectedCategory = useMemo(() => {
    if (watchedCategoryId == null || watchedCategoryId === "") return undefined;
    return categories.find((category) => category.id === watchedCategoryId);
  }, [categories, watchedCategoryId]);
  const showImage =
    pendingPreviewUrl ??
    (removeImage ? null : (existingImageUrl ?? null));
  const busy = submitting || isSubmitting;
  const isArchived = initial?.archivedAt != null;
  const diverged = initial ? hasDivergedFromReference(initial) : false;
  const referenceOrigin =
    initial?.source.datasetName ??
    initial?.source.datasetId ??
    null;
  const showProvenance =
    initial != null &&
    (initial.source.kind === "reference" ||
      diverged ||
      initial.source.entryCode != null);

  const onImageSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    try {
      const resized = await resizeRecipeImage(file, { aspect: 1 });
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

  const nameErrorId = "ingredient-name-error";
  const kcalErrorId = "ingredient-kcal-error";
  const proteinErrorId = "ingredient-protein-error";
  const carbsErrorId = "ingredient-carbs-error";
  const fatErrorId = "ingredient-fat-error";
  const sodiumErrorId = "ingredient-sodium-error";

  return (
    <form
      className="mx-auto max-w-xl space-y-8"
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit({
            values,
            image: pendingImage,
            removeImage: removeImage && !pendingImage,
          });
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Could not save ingredient",
          );
        }
      })}
      noValidate
    >
      {showProvenance ? (
        <p className="text-sm text-muted-foreground" data-testid="ingredient-provenance">
          {diverged
            ? `Originally ${referenceOrigin ?? "a reference dataset"}${
                initial?.source.entryCode
                  ? ` (${initial.source.entryCode})`
                  : ""
              }, since edited by you.`
            : initial?.source.kind === "reference"
              ? `Figures from ${referenceOrigin ?? "reference dataset"}${
                  initial.source.entryCode
                    ? ` · ${initial.source.entryCode}`
                    : ""
                }.`
              : initial?.source.entryCode
                ? `Source entry ${initial.source.entryCode}.`
                : null}
          {initial?.source.url ? (
            <>
              {" "}
              <a
                href={initial.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-link)] underline-offset-2 hover:underline"
              >
                Check source
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="ingredient-name">Name (required)</Label>
        <Input
          id="ingredient-name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? nameErrorId : undefined}
          {...register("name")}
        />
        <FieldError id={nameErrorId} message={errors.name?.message} />
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-4">
          <IngredientIdentity
            category={selectedCategory}
            imageUrl={showImage}
            name={watchedName.trim() || "Ingredient"}
            size="lg"
            labelled
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium text-foreground">Photo (optional)</p>
            <p className="text-sm text-muted-foreground">
              Category icon fills this slot when no photo is set. Upload lives
              here in the editor only — lists never look ragged.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              id="ingredient-image-input"
              onChange={(event) => {
                void onImageSelected(event.target.files?.[0]);
              }}
            />
            <div className="flex flex-wrap gap-2">
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
      </div>

      <div className="space-y-2">
        <Label id="ingredient-category-label">Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Choice
              id="ingredient-category"
              aria-labelledby="ingredient-category-label"
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value === "" ? null : value);
              }}
              options={[
                { value: "", label: "Uncategorized" },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
            />
          )}
        />
      </div>

      <div className="space-y-2">
        <Label id="ingredient-measure-kind-label">Measure kind (required)</Label>
        <Controller
          control={control}
          name="measureKind"
          render={({ field }) => (
            <SegmentedGroup
              id="ingredient-measure-kind"
              aria-labelledby="ingredient-measure-kind-label"
              aria-describedby="ingredient-measure-kind-help"
              value={field.value}
              disabled={measureKindLocked}
              onValueChange={(value) => field.onChange(value as MeasureKind)}
              options={MEASURE_KIND_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                helperText: option.helperText,
                disabled: measureKindLocked,
                disabledReason: measureKindLocked
                  ? "Locked because this ingredient is already used"
                  : undefined,
              }))}
            />
          )}
        />
        <p
          id="ingredient-measure-kind-help"
          className="text-sm text-muted-foreground"
        >
          {measureKindLocked
            ? "Measure kind is locked because this ingredient is used in a recipe, pantry, plan, or log."
            : "Choose how quantities are measured. This cannot change once the ingredient is used."}
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-foreground">
          Nutrition {basisLabel}
        </legend>
        <p className="text-sm text-muted-foreground">
          Enter values as printed on the label for the fixed basis above. kcal
          is stored as entered — not derived from macros.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ingredient-kcal">Calories (kcal)</Label>
            <Input
              id="ingredient-kcal"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-invalid={errors.nutrition?.kcal ? true : undefined}
              aria-describedby={
                errors.nutrition?.kcal ? kcalErrorId : undefined
              }
              {...register("nutrition.kcal", { valueAsNumber: true })}
            />
            <FieldError
              id={kcalErrorId}
              message={errors.nutrition?.kcal?.message}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingredient-protein">Protein (g)</Label>
            <Input
              id="ingredient-protein"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-invalid={errors.nutrition?.proteinG ? true : undefined}
              aria-describedby={
                errors.nutrition?.proteinG ? proteinErrorId : undefined
              }
              {...register("nutrition.proteinG", { valueAsNumber: true })}
            />
            <FieldError
              id={proteinErrorId}
              message={errors.nutrition?.proteinG?.message}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingredient-carbs">Carbohydrates (g)</Label>
            <Input
              id="ingredient-carbs"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-invalid={errors.nutrition?.carbsG ? true : undefined}
              aria-describedby={
                errors.nutrition?.carbsG ? carbsErrorId : undefined
              }
              {...register("nutrition.carbsG", { valueAsNumber: true })}
            />
            <FieldError
              id={carbsErrorId}
              message={errors.nutrition?.carbsG?.message}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingredient-fat">Fat (g)</Label>
            <Input
              id="ingredient-fat"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-invalid={errors.nutrition?.fatG ? true : undefined}
              aria-describedby={
                errors.nutrition?.fatG ? fatErrorId : undefined
              }
              {...register("nutrition.fatG", { valueAsNumber: true })}
            />
            <FieldError
              id={fatErrorId}
              message={errors.nutrition?.fatG?.message}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingredient-sodium">Sodium (mg)</Label>
            <Input
              id="ingredient-sodium"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="Unknown"
              aria-invalid={errors.nutrition?.sodiumMg ? true : undefined}
              aria-describedby={
                errors.nutrition?.sodiumMg ? sodiumErrorId : undefined
              }
              {...register("nutrition.sodiumMg", {
                setValueAs: (value) => {
                  if (value === "" || value === null || value === undefined) {
                    return null;
                  }
                  const n = typeof value === "number" ? value : Number(value);
                  return Number.isNaN(n) ? null : n;
                },
              })}
            />
            <p className="text-sm text-muted-foreground">
              Leave blank when unknown — never treated as zero.
            </p>
            <FieldError
              id={sodiumErrorId}
              message={errors.nutrition?.sodiumMg?.message}
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="ingredient-notes">Notes</Label>
        <Textarea
          id="ingredient-notes"
          rows={3}
          {...register("notes")}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                      : "Could not archive ingredient",
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
                      : "Could not restore ingredient",
                  );
                });
              }}
            >
              Restore
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {initial ? "Save changes" : "Create ingredient"}
          </Button>
        </div>
      </div>
    </form>
  );
}

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  emptyIngredientFormValues,
  IngredientFormSchema,
  nutritionBasisLabel,
  type Ingredient,
  type IngredientCategory,
  type IngredientFormParsed,
  type IngredientFormValues,
  type MeasureKind,
} from "@/domain";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { NativeSelect } from "@/ui/native-select";
import { Textarea } from "@/ui/textarea";

const MEASURE_KIND_OPTIONS: { value: MeasureKind; label: string }[] = [
  { value: "mass", label: "Mass (g / kg)" },
  { value: "volume", label: "Volume (ml / L)" },
  { value: "count", label: "Count (items)" },
];

export type IngredientFormProps = {
  categories: IngredientCategory[];
  initial?: Ingredient;
  measureKindLocked: boolean;
  submitting?: boolean;
  onSubmit: (values: IngredientFormParsed) => Promise<void>;
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

  const measureKind = useWatch({ control, name: "measureKind" }) ?? "mass";
  const basisLabel = nutritionBasisLabel(measureKind);
  const busy = submitting || isSubmitting;
  const isArchived = initial?.archivedAt != null;

  const nameErrorId = "ingredient-name-error";
  const kcalErrorId = "ingredient-kcal-error";
  const proteinErrorId = "ingredient-protein-error";
  const carbsErrorId = "ingredient-carbs-error";
  const fatErrorId = "ingredient-fat-error";

  return (
    <form
      className="mx-auto max-w-xl space-y-8"
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Could not save ingredient",
          );
        }
      })}
      noValidate
    >
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

      <div className="space-y-2">
        <Label htmlFor="ingredient-category">Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <NativeSelect
              id="ingredient-category"
              value={field.value ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                field.onChange(value === "" ? null : value);
              }}
              onBlur={field.onBlur}
              ref={field.ref}
            >
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ingredient-measure-kind">Measure kind (required)</Label>
        <Controller
          control={control}
          name="measureKind"
          render={({ field }) => (
            <NativeSelect
              id="ingredient-measure-kind"
              value={field.value}
              disabled={measureKindLocked}
              onChange={(event) =>
                field.onChange(event.target.value as MeasureKind)
              }
              onBlur={field.onBlur}
              ref={field.ref}
              aria-describedby="ingredient-measure-kind-help"
            >
              {MEASURE_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
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

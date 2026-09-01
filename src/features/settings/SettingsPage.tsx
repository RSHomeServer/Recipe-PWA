import { zodResolver } from "@hookform/resolvers/zod";
import { ThemeToggle } from "@songara/pwa-base/ui";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

const settingsSchema = z.object({
  dailyTarget: z
    .string()
    .optional()
    .refine(
      (value) => !value || /^\d+$/.test(value),
      "Enter whole calories only",
    ),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { dailyTarget: "" },
  });

  return (
    <RoutePlaceholder
      title="Settings"
      description="Theme, calorie target, export/import, and preferences."
      actions={<ThemeToggle showLabels />}
    >
      <form
        className="max-w-md space-y-4"
        noValidate
        onSubmit={handleSubmit(() => undefined)}
      >
        <div className="space-y-2">
          <Label htmlFor="daily-target">Daily calorie target (optional)</Label>
          <Input
            id="daily-target"
            inputMode="numeric"
            aria-invalid={errors.dailyTarget ? true : undefined}
            aria-describedby={
              errors.dailyTarget ? "daily-target-error" : undefined
            }
            {...register("dailyTarget")}
          />
          {errors.dailyTarget ? (
            <p id="daily-target-error" className="text-sm text-destructive">
              {errors.dailyTarget.message}
            </p>
          ) : null}
        </div>
        <Button type="submit">Save target</Button>
      </form>
    </RoutePlaceholder>
  );
}

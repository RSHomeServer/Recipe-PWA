import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ThemeToggle } from "@songara/pwa-base/ui";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  STARTER_PACK_ATTRIBUTION,
  STARTER_PACK_VERSION,
  seedBothPacks,
  useRecipeData,
} from "@/data";
import {
  FLAVOUR_PACK_ATTRIBUTION,
  FLAVOUR_PACK_VERSION,
} from "@/data/flavour-pack";
import { useSettings } from "@/features/shopping/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

const settingsSchema = z.object({
  dailyTarget: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.trim() === "" || /^\d+$/.test(value.trim()),
      "Enter whole calories only",
    )
    .refine((value) => {
      if (!value || value.trim() === "") return true;
      const n = Number(value.trim());
      return n > 0;
    }, "Target must be a positive number"),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { db, repos } = useRecipeData();
  const settings = useSettings();
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [lastTopUp, setLastTopUp] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { dailyTarget: "" },
  });

  useEffect(() => {
    if (!settings) return;
    reset({
      dailyTarget:
        settings.dailyCalorieTarget != null
          ? String(Math.round(settings.dailyCalorieTarget))
          : "",
    });
  }, [settings, reset]);

  if (settings === undefined) {
    return (
      <div className="app-page prose">
        <PageHeader
          title="Settings"
          description="Theme, calorie target, and preferences."
        />
        <RouteStatePanel
          state="loading"
          config={{
            empty: { title: "No settings" },
            loading: { rows: 2 },
            error: {
              title: "Could not load settings",
              description: "Settings are stored on this device.",
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-page prose space-y-10">
      <PageHeader
        title="Settings"
        description="Theme, calorie target, and preferences."
        actions={<ThemeToggle showLabels />}
      />
      <form
        className="max-w-md space-y-4"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          if (!repos) return;
          const trimmed = values.dailyTarget?.trim() ?? "";
          const dailyCalorieTarget =
            trimmed === "" ? null : Number(trimmed);
          await repos.settings.put({
            ...settings,
            dailyCalorieTarget,
          });
          toast.success(
            dailyCalorieTarget == null
              ? "Calorie target cleared"
              : "Calorie target saved",
          );
        })}
      >
        <div className="space-y-2">
          <Label htmlFor="daily-target">Daily calorie target (optional)</Label>
          <Input
            id="daily-target"
            inputMode="numeric"
            placeholder="e.g. 2400"
            aria-invalid={errors.dailyTarget ? true : undefined}
            aria-describedby={
              errors.dailyTarget
                ? "daily-target-error"
                : "daily-target-hint"
            }
            {...register("dailyTarget")}
          />
          <p id="daily-target-hint" className="text-sm text-muted-foreground">
            Manual entry only. Leave blank to clear. Insights and Today show
            target · consumed · remaining when set — no rings or fitness framing.
          </p>
          {errors.dailyTarget ? (
            <p id="daily-target-error" className="text-sm text-destructive">
              {errors.dailyTarget.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting || !repos}>
            Save target
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || !repos || settings.dailyCalorieTarget == null}
            onClick={async () => {
              if (!repos) return;
              await repos.settings.put({
                ...settings,
                dailyCalorieTarget: null,
              });
              reset({ dailyTarget: "" });
              toast.success("Calorie target cleared");
            }}
          >
            Clear
          </Button>
        </div>
      </form>

      <section className="max-w-md space-y-3" aria-labelledby="how-it-works-settings">
        <h2 id="how-it-works-settings" className="text-lg font-semibold">
          How this works
        </h2>
        <p className="text-sm text-muted-foreground">
          A short explanation of pantry → batch → plan → shop appears at the top
          of Plan and Cook until you dismiss it.
        </p>
        {settings.howItWorksDismissed ? (
          <Button
            type="button"
            variant="outline"
            disabled={!repos}
            onClick={async () => {
              if (!repos) return;
              await repos.settings.put({
                ...settings,
                howItWorksDismissed: false,
              });
              toast.success("How this works will show again on Plan and Cook");
            }}
          >
            Show “How this works” again
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            The panel is currently visible on Plan and Cook.
          </p>
        )}
      </section>

      <section className="max-w-lg space-y-3" aria-labelledby="starter-pack-heading">
        <h2 id="starter-pack-heading" className="text-lg font-semibold">
          Starter ingredients
        </h2>
        <p className="text-sm text-muted-foreground">
          Adds any missing CoFID and USDA flavour-pack reference ingredients.
          Existing rows are never overwritten — including ones you have edited.
        </p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            CoFID pack:{" "}
            <span className="font-medium text-foreground">
              {settings.starterPackVersion ?? "not seeded yet"}
            </span>{" "}
            (current build: {STARTER_PACK_VERSION})
          </li>
          <li>
            Flavour pack:{" "}
            <span className="font-medium text-foreground">
              {settings.flavourPackVersion ?? "not seeded yet"}
            </span>{" "}
            (current build: {FLAVOUR_PACK_VERSION})
          </li>
        </ul>
        <Button
          type="button"
          variant="outline"
          disabled={!db || topUpBusy}
          onClick={async () => {
            if (!db) return;
            setTopUpBusy(true);
            try {
              const report = await seedBothPacks(db);
              const formatPack = (
                label: string,
                pack: { added: number; skippedExisting: number; skippedInvalid: number },
              ) =>
                `${label}: added ${pack.added}, skipped ${pack.skippedExisting} already present${
                  pack.skippedInvalid > 0
                    ? `, ${pack.skippedInvalid} invalid`
                    : ""
                }`;
              const summary = [
                formatPack("CoFID", report.starter),
                formatPack("Flavour", report.flavour),
              ].join(". ");
              setLastTopUp(summary);
              const totalAdded = report.starter.added + report.flavour.added;
              toast.success(
                totalAdded > 0
                  ? `Added ${report.starter.added} CoFID + ${report.flavour.added} flavour ingredients`
                  : "No missing starter or flavour ingredients",
              );
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not top up starter ingredients",
              );
            } finally {
              setTopUpBusy(false);
            }
          }}
        >
          {topUpBusy ? "Adding…" : "Add missing starter ingredients"}
        </Button>
        {lastTopUp ? (
          <p className="text-sm text-muted-foreground" role="status">
            {lastTopUp}
          </p>
        ) : null}
      </section>

      <section className="max-w-lg space-y-3" aria-labelledby="about-heading">
        <h2 id="about-heading" className="text-lg font-semibold">
          About
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {STARTER_PACK_ATTRIBUTION.title}
          </p>
          <p>{STARTER_PACK_ATTRIBUTION.body}</p>
          <p>
            Dataset:{" "}
            <a
              className="underline-offset-4 hover:underline"
              href={STARTER_PACK_ATTRIBUTION.datasetUrl}
              target="_blank"
              rel="noreferrer"
            >
              {STARTER_PACK_ATTRIBUTION.datasetName}
            </a>
          </p>
          <p>
            Licence:{" "}
            <span className="font-medium text-foreground">
              {STARTER_PACK_ATTRIBUTION.licenceLabel}
            </span>
            {!STARTER_PACK_ATTRIBUTION.licenceConfirmed ? (
              <span>
                {" "}
                — confirm from the GOV.UK publication page licence footer before
                release.
              </span>
            ) : null}
          </p>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {FLAVOUR_PACK_ATTRIBUTION.title}
          </p>
          <p>{FLAVOUR_PACK_ATTRIBUTION.body}</p>
          <p>
            Dataset:{" "}
            <a
              className="underline-offset-4 hover:underline"
              href={FLAVOUR_PACK_ATTRIBUTION.datasetUrl}
              target="_blank"
              rel="noreferrer"
            >
              {FLAVOUR_PACK_ATTRIBUTION.datasetName}
            </a>
          </p>
          <p>
            Licence:{" "}
            <span className="font-medium text-foreground">
              {FLAVOUR_PACK_ATTRIBUTION.licenceLabel}
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}

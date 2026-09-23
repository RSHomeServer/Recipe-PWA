import { lazy, Suspense, useId, useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AttributionList,
  MacroBar,
  TargetReadout,
} from "@/features/components/domain-stubs";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { RouteStatePanel } from "@/features/shared/RouteStatePanel";
import {
  formatDayCompact,
  formatKcal,
  formatMacroG,
  formatPct,
  formatWeekRangeLabel,
  macroEnergyShare,
  todayIso,
  type FoldBucket,
  type Nutrition,
  type RankedBucket,
} from "@/domain";
import { Button } from "@/ui/button";
import { useInsightsData } from "./hooks";

const WeekBarsChart = lazy(() => import("./charts/WeekBarsChart"));
const HorizontalBarsChart = lazy(() => import("./charts/HorizontalBarsChart"));

const insightsStateConfig = {
  empty: {
    title: "Log a few meals and this will show where your calories came from.",
    actionLabel: "Open log",
  },
  loading: { rows: 4 },
  error: {
    title: "Could not load insights",
    description: "Insights are computed from your local meal log.",
  },
} as const;

function macroSegments(n: Nutrition) {
  return [
    {
      key: "protein" as const,
      value: Math.round(macroEnergyShare(n, "proteinG") * 100),
      label: "Protein",
    },
    {
      key: "carbs" as const,
      value: Math.round(macroEnergyShare(n, "carbsG") * 100),
      label: "Carbs",
    },
    {
      key: "fat" as const,
      value: Math.round(macroEnergyShare(n, "fatG") * 100),
      label: "Fat",
    },
  ];
}

function NutritionFigures({ n }: { n: Nutrition }) {
  return (
    <dl className="num flex flex-wrap gap-x-6 gap-y-2 text-base">
      <div>
        <dt className="text-sm text-muted-foreground">Calories</dt>
        <dd className="font-semibold">{formatKcal(n.kcal)} kcal</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Protein</dt>
        <dd>{formatMacroG(n.proteinG)} g</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Carbs</dt>
        <dd>{formatMacroG(n.carbsG)} g</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Fat</dt>
        <dd>{formatMacroG(n.fatG)} g</dd>
      </div>
    </dl>
  );
}

function KcalTable({
  caption,
  rows,
}: {
  caption: string;
  rows: { label: string; kcal: number; muted?: boolean }[];
}) {
  const total = rows.reduce((s, r) => s + r.kcal, 0) || 1;
  return (
    <table className="w-full text-left text-base">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border text-sm text-muted-foreground">
          <th scope="col" className="py-2 font-medium">
            Name
          </th>
          <th scope="col" className="py-2 font-medium num text-right">
            kcal
          </th>
          <th scope="col" className="py-2 font-medium num text-right">
            %
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.label}
            className={
              row.muted ? "text-muted-foreground" : "text-foreground"
            }
          >
            <th scope="row" className="py-2 font-normal">
              {row.label}
            </th>
            <td className="py-2 num text-right">{formatKcal(row.kcal)}</td>
            <td className="py-2 num text-right">
              {formatPct(row.kcal / total)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className="space-y-4" aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChartFallback() {
  return (
    <div
      className="h-[200px] w-full animate-pulse rounded-md bg-muted md:h-[280px]"
      aria-hidden="true"
    />
  );
}

function barColour(bucket: RankedBucket | FoldBucket): string {
  if ("isUnattributed" in bucket && bucket.isUnattributed) {
    return "var(--color-macro-none)";
  }
  if ("isOther" in bucket && bucket.isOther) {
    return "var(--color-macro-none)";
  }
  return "var(--color-macro-energy)";
}

export default function InsightsPage() {
  const today = useMemo(() => todayIso(), []);
  const data = useInsightsData(today);
  const navigate = useNavigate();

  if (data === undefined) {
    return (
      <div className="app-page">
        <PageHeader
          title="Insights"
          description="Where your calories came from — organised by question."
        />
        <RouteStatePanel state="loading" config={insightsStateConfig} />
      </div>
    );
  }

  const hasLogs = data.logs.length > 0;
  if (!hasLogs) {
    return (
      <div className="app-page">
        <PageHeader
          title="Insights"
          description="Where your calories came from — organised by question."
        />
        <RouteStatePanel
          state="empty"
          config={insightsStateConfig}
          onAction={() => {
            navigate("/log");
          }}
        />
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/log">Open log</Link>
          </Button>
        </div>
      </div>
    );
  }

  const weekTotal = data.weekAverage.total;
  const attributionItems = data.byIngredientRanked.map((b) => ({
    name: b.label,
    percent: Number(
      formatPct(
        b.nutrition.kcal /
          (weekTotal.kcal > 0 ? weekTotal.kcal : 1),
      ),
    ),
  }));

  const mealRows = data.byMealBuckets.map((b) => ({
    label: b.label,
    kcal: b.nutrition.kcal,
  }));
  const recipeRows = data.byRecipeRanked.map((b) => ({
    label: b.label,
    kcal: b.nutrition.kcal,
    muted: Boolean(b.isOther),
  }));
  const ingredientRows = data.byIngredientRanked.map((b) => ({
    label: b.label,
    kcal: b.nutrition.kcal,
    muted: Boolean(b.isOther || b.isUnattributed),
  }));

  return (
    <div className="app-page space-y-12">
      <PageHeader
        title="Insights"
        description={`Week of ${formatWeekRangeLabel(data.weekRange)}. Derived from your meal log — nothing stored separately.`}
        actions={
          <Button asChild variant="outline">
            <Link to="/settings">Calorie target</Link>
          </Button>
        }
      />

      <TargetReadout target={data.target} consumed={data.todayNutrition.kcal} />

      <Section title="What did I eat today?">
        <NutritionFigures n={data.todayNutrition} />
        <MacroBar segments={macroSegments(data.todayNutrition)} />
        <table className="w-full max-w-md text-left text-base">
          <caption className="sr-only">Today&apos;s macros</caption>
          <thead>
            <tr className="border-b border-border text-sm text-muted-foreground">
              <th scope="col" className="py-2 font-medium">
                Macro
              </th>
              <th scope="col" className="py-2 font-medium num text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="py-2 font-normal">
                Protein
              </th>
              <td className="py-2 num text-right">
                {formatMacroG(data.todayNutrition.proteinG)} g
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2 font-normal">
                Carbs
              </th>
              <td className="py-2 num text-right">
                {formatMacroG(data.todayNutrition.carbsG)} g
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-2 font-normal">
                Fat
              </th>
              <td className="py-2 num text-right">
                {formatMacroG(data.todayNutrition.fatG)} g
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="How did this week go?">
        <p className="text-base text-muted-foreground">
          Average{" "}
          <span className="num text-foreground">
            {formatKcal(data.weekAverage.average.kcal)} kcal/day
          </span>{" "}
          across{" "}
          <span className="num text-foreground">
            {data.weekAverage.daysWithLogs}
          </span>{" "}
          day{data.weekAverage.daysWithLogs === 1 ? "" : "s"} with logs (not ÷
          7). Week total {formatKcal(weekTotal.kcal)} kcal.
        </p>
        <Suspense fallback={<ChartFallback />}>
          <WeekBarsChart
            days={data.weekByDay.map((b) => ({
              label: formatDayCompact(b.key),
              date: b.key,
              kcal: b.nutrition.kcal,
            }))}
            target={data.target}
          />
        </Suspense>
        <KcalTable
          caption="Calories by day this week"
          rows={data.weekByDay.map((b) => ({
            label: formatDayCompact(b.key),
            kcal: b.nutrition.kcal,
          }))}
        />
      </Section>

      <Section title="Which meals did calories come from?">
        <Suspense fallback={<ChartFallback />}>
          <HorizontalBarsChart
            rows={data.byMealBuckets.map((b) => ({
              label: b.label,
              kcal: b.nutrition.kcal,
              colour: "var(--color-macro-energy)",
            }))}
          />
        </Suspense>
        <KcalTable caption="Calories by meal slot" rows={mealRows} />
      </Section>

      <Section title="Which recipes?">
        <Suspense fallback={<ChartFallback />}>
          <HorizontalBarsChart
            rows={data.byRecipeRanked.map((b) => ({
              label: b.label,
              kcal: b.nutrition.kcal,
              colour: barColour(b),
            }))}
          />
        </Suspense>
        <KcalTable
          caption="Calories by recipe (top 8 + other)"
          rows={recipeRows}
        />
      </Section>

      <Section title="Which ingredients?">
        <p className="text-base text-muted-foreground">
          The headline view — where this week&apos;s calories came from at
          ingredient level. Unattributed covers custom foods.
        </p>
        <AttributionList items={attributionItems} />
        <Suspense fallback={<ChartFallback />}>
          <HorizontalBarsChart
            rows={data.byIngredientRanked.map((b) => ({
              label: b.label,
              kcal: b.nutrition.kcal,
              colour: barColour(b),
            }))}
          />
        </Suspense>
        <KcalTable
          caption="Calories by ingredient (top 10 + other + unattributed)"
          rows={ingredientRows}
        />
      </Section>
    </div>
  );
}

import { Link } from "react-router-dom";
import { TargetReadout } from "@/features/components/domain-stubs";
import { useTodayConsumedKcal } from "@/features/insights/hooks";
import { useSettings } from "@/features/shopping/hooks";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { todayIso } from "@/domain";
import { Button } from "@/ui/button";

export default function TodayPage() {
  const today = todayIso();
  const settings = useSettings();
  const consumed = useTodayConsumedKcal(today);

  return (
    <div className="app-page content">
      <PageHeader
        title="Today"
        description="What to eat, quick-log, and plan for today."
        actions={
          <Button asChild>
            <Link to="/log">Log a meal</Link>
          </Button>
        }
      />

      {settings != null && consumed != null ? (
        <div className="mb-8">
          <TargetReadout
            target={settings.dailyCalorieTarget}
            consumed={consumed}
          />
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="today-quick-log">
        <h2 id="today-quick-log" className="font-display text-lg font-semibold">
          Quick log
        </h2>
        <p className="max-w-prose text-base text-muted-foreground">
          The diary on Log is the source of truth for what you ate. Jump there to
          log from today&apos;s plan or add a meal by slot.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/log">Open log</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/insights">Insights</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

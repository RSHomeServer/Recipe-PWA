import { Link } from "react-router-dom";
import { PageHeader } from "@/features/shared/RoutePlaceholder";
import { Button } from "@/ui/button";

export default function TodayPage() {
  return (
    <div className="app-page">
      <PageHeader
        title="Today"
        description="What to eat, quick-log, and plan for today."
        actions={
          <Button asChild>
            <Link to="/log">Log a meal</Link>
          </Button>
        }
      />
      <section className="space-y-3" aria-labelledby="today-quick-log">
        <h2 id="today-quick-log" className="font-display text-lg font-semibold">
          Quick log
        </h2>
        <p className="max-w-prose text-base text-muted-foreground">
          The diary on Log is the source of truth for what you ate. Jump there to
          log from today&apos;s plan or add a meal by slot.
        </p>
        <Button asChild variant="outline">
          <Link to="/log">Open log</Link>
        </Button>
      </section>
    </div>
  );
}

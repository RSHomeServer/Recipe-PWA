import { MorePageLinks } from "@/app/shell/ShellLayout";
import { RoutePlaceholder } from "@/features/shared/RoutePlaceholder";

export default function MorePage() {
  return (
    <RoutePlaceholder
      title="More"
      description="Library, batches, insights, and settings."
    >
      <MorePageLinks />
    </RoutePlaceholder>
  );
}

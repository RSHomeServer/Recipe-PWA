import { ThemeToggle } from "@songara/pwa-base/ui";
import { NavLink, Outlet } from "react-router-dom";
import { primaryNavItems, secondaryNavItems } from "@/app/shell/navigation";

function NavIcon({ label }: { label: string }) {
  return (
    <span className="text-lg leading-none" aria-hidden="true">
      {label}
    </span>
  );
}

export function ShellLayout() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Main navigation">
        <div className="mb-4 px-3">
          <p className="font-display text-xl font-semibold">Recipe</p>
        </div>
        <nav aria-label="Primary">
          {primaryNavItems
            .filter((item) => item.id !== "more")
            .map((item) => (
              <NavLink
                key={item.id}
                to={item.href}
                end={item.href === "/"}
                className="app-sidebar-link"
              >
                <NavIcon label={item.icon} />
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="app-sidebar-section">
          <p className="app-sidebar-label">Library</p>
          <nav aria-label="Library">
            {secondaryNavItems.map((item) => (
              <NavLink key={item.id} to={item.href} className="app-sidebar-link">
                <NavIcon label={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-auto px-3 pt-4">
          <ThemeToggle showLabels />
        </div>
      </aside>

      <div className="app-main">
        <Outlet />
      </div>

      <nav className="app-bottom-nav" aria-label="Primary">
        {primaryNavItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.href}
            end={item.href === "/"}
            className="app-nav-link"
          >
            <NavIcon label={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function MorePageLinks() {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {secondaryNavItems.map((item) => (
        <li key={item.id}>
          <NavLink
            to={item.href}
            className={({ isActive }) =>
              [
                "app-sidebar-link",
                isActive ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]" : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <NavIcon label={item.icon} />
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}


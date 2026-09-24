import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  titleAccessory?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  titleAccessory,
  actions,
}: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          {titleAccessory}
        </div>
        {description ? (
          typeof description === "string" ? (
            <p className="max-w-prose text-base text-muted-foreground">
              {description}
            </p>
          ) : (
            <div className="max-w-prose text-base text-muted-foreground">
              {description}
            </div>
          )
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export type RoutePlaceholderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function RoutePlaceholder({
  title,
  description,
  actions,
  children,
}: RoutePlaceholderProps) {
  return (
    <div className="app-page content">
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

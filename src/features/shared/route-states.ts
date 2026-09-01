export type ViewState = "empty" | "loading" | "error";

export type RouteStateConfig = {
  empty: {
    title: string;
    description?: string;
    actionLabel?: string;
  };
  loading: {
    rows?: number;
  };
  error: {
    title: string;
    description: string;
    retryLabel?: string;
  };
};

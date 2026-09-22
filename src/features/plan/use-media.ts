import { useEffect, useState } from "react";

/** True when viewport matches `(min-width: 48rem)` — Tailwind `md`. */
export function useIsMdUp(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 48rem)").matches
      : true,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 48rem)");
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return matches;
}

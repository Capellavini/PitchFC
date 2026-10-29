import { useEffect, useState } from "react";

/** true while the viewport is at least `px` wide (matchMedia, live). */
export default function useMinWidth(px) {
  const query = `(min-width: ${px}px)`;
  const read = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const q = window.matchMedia(query);
    const on = () => setMatches(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [query]);
  return matches;
}

// components/HashScroller.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function HashScroller() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Always scroll to top on route change
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }
    // If there is a hash, try to scroll to it
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pathname, hash]);

  return null;
}

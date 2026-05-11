import { useEffect } from "react";

/**
 * Calls `onEscape` whenever the Escape key is pressed at the window level.
 * Used to dismiss modals, panels, etc. without coupling to a specific element.
 */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onEscape]);
}

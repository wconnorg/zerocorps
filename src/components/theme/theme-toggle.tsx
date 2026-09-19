"use client";

import { useLayoutEffect } from "react";
import {
  THEME_ATTRIBUTE,
  applyTheme,
  otherTheme,
  parseThemeCookie,
  readAppliedTheme,
} from "@/lib/theme";

export function ThemeToggle() {
  // In development, React Strict Mode remounts the tree once and resets <html>
  // to the attributes written in JSX, dropping the one the inline script set.
  // Re-apply the saved theme before paint. In production this is a no-op.
  useLayoutEffect(() => {
    const saved = parseThemeCookie(document.cookie);
    if (saved) document.documentElement.setAttribute(THEME_ATTRIBUTE, saved);
  }, []);

  return (
    <button
      type="button"
      onClick={() => applyTheme(otherTheme(readAppliedTheme()))}
      aria-label="Switch colour theme"
      title="Switch colour theme"
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-fg"
    >
      {/*
        Both icons are always rendered and CSS shows the right one for the
        active theme. The server cannot know the visitor's theme, so choosing in
        JavaScript would cause a hydration mismatch or a flicker.
      */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="hidden size-[18px] dark:block"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="hidden size-[18px] light:block"
      >
        <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7Z" />
      </svg>
    </button>
  );
}

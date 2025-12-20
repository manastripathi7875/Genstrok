// components/ThemeToggle.tsx
import React from "react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();

  // avoid rendering toggle UI until mounted to prevent hydration mismatch
  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      title={`Theme: ${theme}`}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 hover:bg-slate-800 text-base"
    >
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
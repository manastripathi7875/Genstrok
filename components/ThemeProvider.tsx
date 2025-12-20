// components/ThemeProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

/**
 * SSR-safe ThemeProvider for Next.js.
 * - saves choice to localStorage
 * - applies `data-theme="light"` / `data-theme="dark"` on <html>
 * - exposes mounted flag so components avoid hydration mismatch
 */

type ThemeName = "light" | "dark";

type ThemeContextVal = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggle: () => void;
  mounted: boolean;
  resolved: ThemeName; // resolved after mount (same as theme)
};

const ThemeContext = createContext<ThemeContextVal | null>(null);

export function useThemeSafe(): ThemeContextVal {
  // safe hook that returns a default if provider missing
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  // fallback: server-side friendly defaults
  const noop = () => {};
  return {
    theme: "dark",
    setTheme: noop,
    toggle: noop,
    mounted: false,
    resolved: "dark",
  };
}

/**
 * Real named export for compatibility with old imports.
 * If your code calls useTheme(), change to useThemeSafe or keep alias below.
 */
export const useTheme = useThemeSafe;

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    // initial default is dark to avoid flash; real value resolved on mount
    return "dark";
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // on mount, read localStorage / prefers-color-scheme
    try {
      const stored = localStorage.getItem("protera_theme");
      if (stored === "light" || stored === "dark") {
        setThemeState(stored);
      } else {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        setThemeState(prefersDark ? "dark" : "light");
      }
    } catch (e) {
      // ignore
    } finally {
      setMounted(true);
    }
  }, []);

  useEffect(() => {
    // keep html[data-theme] in sync
    if (!mounted) return;
    try {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("protera_theme", theme);
    } catch (e) {}
  }, [mounted, theme]);

  const setTheme = (t: ThemeName) => setThemeState(t);
  const toggle = () => setThemeState((s) => (s === "dark" ? "light" : "dark"));

  const ctx = useMemo(
    () => ({
      theme,
      setTheme,
      toggle,
      mounted,
      resolved: theme,
    }),
    [theme, mounted]
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
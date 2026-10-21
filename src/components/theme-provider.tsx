"use client";

import * as React from "react";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "aegis-theme";

/**
 * ORION is the only theme: the light palette was removed from globals.css, so
 * every path here resolves dark. The context keeps its shape (components read
 * `resolvedTheme`), but `setTheme` can no longer produce a light render, and
 * the head script forces the `.dark` class before first paint so there is no
 * flash of an unthemed frame.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const resolvedTheme: ResolvedTheme = "dark";

  const setTheme = React.useCallback((next: Theme) => {
    // Persist the preference for forward compatibility, but the resolved
    // theme stays dark until a light palette exists again.
    window.localStorage.setItem(STORAGE_KEY, next === "light" ? "dark" : next);
    document.documentElement.classList.add("dark");
  }, []);

  const value = React.useMemo(
    () => ({ theme: "dark" as Theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export const themeInitScript = `
(function(){
  try { document.documentElement.classList.add('dark'); } catch (e) {}
})();
`;

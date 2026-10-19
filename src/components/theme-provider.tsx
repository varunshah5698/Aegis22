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

function resolve(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: Theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);
    const next = resolve(initial);
    setResolvedTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme !== "system") return;
      const next = media.matches ? "dark" : "light";
      setResolvedTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    const resolved = resolve(next);
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
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
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var dark = stored === 'dark' || ((!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

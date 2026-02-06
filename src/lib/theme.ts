export type Theme = "light" | "dark";

const STORAGE_KEY = "nav_theme";
const COOKIE_KEY = "nav_theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
  // Set cookie so SSR can read it
  document.cookie = `${COOKIE_KEY}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function initTheme(): void {
  const theme = getTheme();
  document.documentElement.setAttribute("data-theme", theme);
}

export type Theme = "light" | "dark";

const STORAGE_KEY = "nav_theme";
const COOKIE_KEY = "nav_theme";

export function getTheme(): Theme {
  return "dark";
}

export function setTheme(_theme?: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, "dark");
  document.documentElement.setAttribute("data-theme", "dark");
  document.cookie = `${COOKIE_KEY}=dark; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function initTheme(): void {
  document.documentElement.setAttribute("data-theme", "dark");
}

const GTM_AUTH_KEY = "gtm_dashboard_authed";

export function isGtmAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GTM_AUTH_KEY) === "true";
}

export function setGtmAuthed() {
  localStorage.setItem(GTM_AUTH_KEY, "true");
}

export function clearGtmAuth() {
  localStorage.removeItem(GTM_AUTH_KEY);
}

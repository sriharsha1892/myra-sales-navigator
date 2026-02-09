import { useStore } from "./store";

/**
 * Fire-and-forget logging of individual email copies.
 * Inserts into contact_extractions with destination='email_copy'.
 */
export function logEmailCopy(email: string, contactName: string, companyDomain: string) {
  const userName = useStore.getState().userName;
  fetch("/api/contact/log-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, contactName, companyDomain, userName }),
  }).catch(() => {});
}

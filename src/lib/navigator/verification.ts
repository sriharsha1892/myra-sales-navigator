import type { Contact } from "./types";

export function getVerificationDotColor(contact: Contact): string {
  switch (contact.verificationStatus) {
    case "valid": return "bg-success";
    case "valid_risky": return "bg-warning";
    case "invalid": return "bg-danger";
    default: return "bg-surface-3 ring-1 ring-text-tertiary";
  }
}

export function getConfidenceDotColor(contact: Contact): string {
  if (contact.emailConfidence >= 90) return "bg-success";
  if (contact.emailConfidence >= 70) return "bg-warning";
  if (contact.emailConfidence >= 50) return "bg-[#f97316]";
  return "bg-text-tertiary";
}

import type { Contact } from "@/lib/navigator/types";

/**
 * Shared test data factories for Navigator API tests.
 */

export function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "ct-1",
    companyDomain: "acme.com",
    companyName: "Acme Corp",
    firstName: "Jane",
    lastName: "Doe",
    title: "VP Sales",
    email: "jane@acme.com",
    phone: null,
    linkedinUrl: null,
    emailConfidence: 80,
    confidenceLevel: "medium",
    sources: ["apollo"],
    seniority: "vp",
    lastVerified: null,
    ...overrides,
  };
}

export function makeExclusion(overrides: Record<string, unknown> = {}) {
  return {
    id: "exc-1",
    type: "domain",
    value: "spam.com",
    reason: "competitor",
    added_by: "Adi",
    created_at: "2026-01-28T10:00:00Z",
    source: "manual",
    ...overrides,
  };
}

export function makePreset(overrides: Record<string, unknown> = {}) {
  return {
    id: "preset-1",
    name: "APAC Food Companies",
    filters: { verticals: ["Food"], regions: ["APAC"] },
    created_by: "Satish",
    created_at: "2026-01-28T10:00:00Z",
    updated_at: "2026-01-28T10:00:00Z",
    ...overrides,
  };
}

export function makeSearchHistoryEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "sh-1",
    user_name: "Satish",
    filters: { verticals: ["Food"], regions: ["APAC"] },
    result_count: 25,
    label: null,
    created_at: "2026-01-28T10:00:00Z",
    ...overrides,
  };
}

export function makeCompanyRecord(overrides: Record<string, unknown> = {}) {
  return {
    domain: "acme.com",
    name: "Acme Corp",
    status: "researching",
    status_changed_by: "Adi",
    status_changed_at: "2026-01-28T10:00:00Z",
    first_viewed_by: "Adi",
    first_viewed_at: "2026-01-27T10:00:00Z",
    last_viewed_by: "Satish",
    last_viewed_at: "2026-01-29T10:00:00Z",
    source: "exa",
    icp_score: 75,
    ...overrides,
  };
}

export function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    companyDomain: "acme.com",
    content: "Looks promising for Q2 outreach",
    authorName: "Adi",
    createdAt: "2026-01-28T10:00:00Z",
    mentions: [],
    ...overrides,
  };
}

export function makeTeamMember(overrides: Record<string, unknown> = {}) {
  return {
    name: "Adi",
    isAdmin: true,
    lastLoginAt: "2026-01-28T10:00:00Z",
    lastMentionReadAt: null,
    ...overrides,
  };
}

export function makeContactPayload(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@acme.com",
    title: "VP Sales",
    companyName: "Acme Corp",
    companyDomain: "acme.com",
    phone: null,
    ...overrides,
  };
}

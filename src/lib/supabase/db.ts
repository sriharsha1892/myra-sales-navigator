import { supabase } from "./client";
import { normalizeDomain } from "../cache";
import type {
  CompanyRecord,
  CompanyNote,
  ContactExtraction,
  ContactSnapshot,
  Exclusion,
} from "../types";

// ---------------------------------------------------------------------------
// Companies (lightweight anchors)
// ---------------------------------------------------------------------------

/** UPSERT: create on first view, update last_viewed on revisit */
export async function ensureCompanyAnchor(
  domain: string,
  name: string,
  viewedBy: string,
  source: string = "exa"
): Promise<CompanyRecord | null> {
  const normalized = normalizeDomain(domain);
  const { data, error } = await supabase
    .from("companies")
    .upsert(
      {
        domain: normalized,
        name,
        first_viewed_by: viewedBy,
        first_viewed_at: new Date().toISOString(),
        last_viewed_by: viewedBy,
        last_viewed_at: new Date().toISOString(),
        source,
      },
      {
        onConflict: "domain",
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    // On conflict, just update the last_viewed fields
    const { data: updated, error: updateErr } = await supabase
      .from("companies")
      .update({
        last_viewed_by: viewedBy,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("domain", normalized)
      .select()
      .single();

    if (updateErr) {
      console.error("ensureCompanyAnchor error:", updateErr);
      return null;
    }
    return mapCompanyRow(updated);
  }

  return mapCompanyRow(data);
}

export async function updateCompanyViewed(domain: string, viewedBy: string) {
  const normalized = normalizeDomain(domain);
  const { error } = await supabase
    .from("companies")
    .update({
      last_viewed_by: viewedBy,
      last_viewed_at: new Date().toISOString(),
    })
    .eq("domain", normalized);

  if (error) console.error("updateCompanyViewed error:", error);
}

export async function getCompanyByDomain(domain: string): Promise<CompanyRecord | null> {
  const normalized = normalizeDomain(domain);
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("domain", normalized)
    .single();

  if (error || !data) return null;
  return mapCompanyRow(data);
}

export async function excludeCompany(
  domain: string,
  excludedBy: string,
  reason?: string
) {
  const normalized = normalizeDomain(domain);
  const { error } = await supabase
    .from("companies")
    .update({
      excluded: true,
      excluded_by: excludedBy,
      excluded_at: new Date().toISOString(),
      exclusion_reason: reason ?? null,
    })
    .eq("domain", normalized);

  if (error) console.error("excludeCompany error:", error);
}

export async function unexcludeCompany(domain: string) {
  const normalized = normalizeDomain(domain);
  const { error } = await supabase
    .from("companies")
    .update({
      excluded: false,
      excluded_by: null,
      excluded_at: null,
      exclusion_reason: null,
    })
    .eq("domain", normalized);

  if (error) console.error("unexcludeCompany error:", error);
}

// ---------------------------------------------------------------------------
// Company Notes
// ---------------------------------------------------------------------------

export async function getNotesForCompany(domain: string): Promise<CompanyNote[]> {
  const normalized = normalizeDomain(domain);
  const { data, error } = await supabase
    .from("company_notes")
    .select("*")
    .eq("company_domain", normalized)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapNoteRow);
}

export async function addNote(
  domain: string,
  content: string,
  authorName: string,
  mentions: string[] = []
): Promise<CompanyNote | null> {
  const normalized = normalizeDomain(domain);
  const { data, error } = await supabase
    .from("company_notes")
    .insert({
      company_domain: normalized,
      content,
      author_name: authorName,
      mentions: JSON.stringify(mentions),
    })
    .select()
    .single();

  if (error) {
    console.error("addNote error:", error);
    return null;
  }
  return mapNoteRow(data);
}

export async function updateNote(
  id: string,
  content: string,
  authorName: string,
  mentions: string[] = []
): Promise<CompanyNote | null> {
  const { data, error } = await supabase
    .from("company_notes")
    .update({
      content,
      updated_at: new Date().toISOString(),
      mentions: JSON.stringify(mentions),
    })
    .eq("id", id)
    .eq("author_name", authorName) // author-only edit
    .select()
    .single();

  if (error) {
    console.error("updateNote error:", error);
    return null;
  }
  return mapNoteRow(data);
}

export async function deleteNote(id: string, authorName: string) {
  const { error } = await supabase
    .from("company_notes")
    .delete()
    .eq("id", id)
    .eq("author_name", authorName); // author-only delete

  if (error) console.error("deleteNote error:", error);
}

// ---------------------------------------------------------------------------
// Contact Extractions
// ---------------------------------------------------------------------------

export async function logExtraction(
  domain: string,
  extractedBy: string,
  destination: ContactExtraction["destination"],
  contacts: ContactSnapshot[]
): Promise<ContactExtraction | null> {
  const normalized = normalizeDomain(domain);
  const { data, error } = await supabase
    .from("contact_extractions")
    .insert({
      company_domain: normalized,
      extracted_by: extractedBy,
      destination,
      contacts: JSON.stringify(contacts),
    })
    .select()
    .single();

  if (error) {
    console.error("logExtraction error:", error);
    return null;
  }
  return mapExtractionRow(data);
}

export async function getExtractionsForCompany(
  domain: string
): Promise<ContactExtraction[]> {
  const normalized = normalizeDomain(domain);
  const { data, error } = await supabase
    .from("contact_extractions")
    .select("*")
    .eq("company_domain", normalized)
    .order("extracted_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapExtractionRow);
}

// ---------------------------------------------------------------------------
// Exclusions
// ---------------------------------------------------------------------------

export async function getAllExclusions(): Promise<Exclusion[]> {
  const { data, error } = await supabase
    .from("exclusions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapExclusionRow);
}

export async function addExclusion(
  type: Exclusion["type"],
  value: string,
  addedBy: string,
  reason?: string,
  source: Exclusion["source"] = "manual"
): Promise<Exclusion | null> {
  const { data, error } = await supabase
    .from("exclusions")
    .insert({ type, value, reason: reason ?? null, added_by: addedBy, source })
    .select()
    .single();

  if (error) {
    console.error("addExclusion error:", error);
    return null;
  }
  return mapExclusionRow(data);
}

export async function addExclusionsBulk(
  items: { type: Exclusion["type"]; value: string; reason?: string }[],
  addedBy: string,
  source: Exclusion["source"] = "csv_upload"
): Promise<number> {
  const rows = items.map((item) => ({
    type: item.type,
    value: item.value,
    reason: item.reason ?? null,
    added_by: addedBy,
    source,
  }));

  const { error, count } = await supabase
    .from("exclusions")
    .insert(rows, { count: "exact" });

  if (error) {
    console.error("addExclusionsBulk error:", error);
    return 0;
  }
  return count ?? rows.length;
}

export async function deleteExclusion(id: string) {
  const { error } = await supabase
    .from("exclusions")
    .delete()
    .eq("id", id);

  if (error) console.error("deleteExclusion error:", error);
}

// ---------------------------------------------------------------------------
// Row mappers (snake_case → camelCase)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapCompanyRow(row: any): CompanyRecord {
  return {
    domain: row.domain,
    name: row.name,
    firstViewedBy: row.first_viewed_by,
    firstViewedAt: row.first_viewed_at,
    lastViewedBy: row.last_viewed_by,
    lastViewedAt: row.last_viewed_at,
    source: row.source,
    noteCount: row.note_count,
    lastNoteAt: row.last_note_at,
    extractionCount: row.extraction_count,
    lastExtractionAt: row.last_extraction_at,
    excluded: row.excluded,
    excludedBy: row.excluded_by,
    excludedAt: row.excluded_at,
    exclusionReason: row.exclusion_reason,
    status: row.status ?? "new",
    statusChangedBy: row.status_changed_by ?? null,
    statusChangedAt: row.status_changed_at ?? null,
    viewedBy: row.viewed_by ?? null,
  };
}

function mapNoteRow(row: any): CompanyNote {
  return {
    id: row.id,
    companyDomain: row.company_domain,
    content: row.content,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    mentions: typeof row.mentions === "string" ? JSON.parse(row.mentions) : (row.mentions ?? []),
  };
}

function mapExtractionRow(row: any): ContactExtraction {
  return {
    id: row.id,
    companyDomain: row.company_domain,
    extractedBy: row.extracted_by,
    extractedAt: row.extracted_at,
    destination: row.destination,
    contacts: typeof row.contacts === "string" ? JSON.parse(row.contacts) : (row.contacts ?? []),
  };
}

function mapExclusionRow(row: any): Exclusion {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    reason: row.reason ?? undefined,
    addedBy: row.added_by,
    addedAt: row.created_at,
    source: row.source ?? "manual",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

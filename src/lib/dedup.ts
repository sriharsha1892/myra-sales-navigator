import type { CompanyEnriched, ResultSource } from "./navigator/types";
import { normalizeDomain } from "./cache";

export function deduplicateCompanies(companies: CompanyEnriched[]): CompanyEnriched[] {
  const byDomain = new Map<string, CompanyEnriched[]>();

  for (const company of companies) {
    const key = normalizeDomain(company.domain);
    const existing = byDomain.get(key) ?? [];
    existing.push(company);
    byDomain.set(key, existing);
  }

  const result: CompanyEnriched[] = [];
  for (const group of byDomain.values()) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      result.push(mergeCompanies(group));
    }
  }
  return result;
}

function mergeCompanies(companies: CompanyEnriched[]): CompanyEnriched {
  const sorted = [...companies].sort(
    (a, b) => new Date(b.lastRefreshed).getTime() - new Date(a.lastRefreshed).getTime()
  );

  const primary = { ...sorted[0] };

  const allSources = new Set<ResultSource>();
  for (const c of sorted) {
    for (const s of c.sources) allSources.add(s);
  }
  primary.sources = Array.from(allSources);

  const signalMap = new Map<string, (typeof primary.signals)[number]>();
  for (const c of sorted) {
    for (const signal of c.signals) {
      if (!signalMap.has(signal.id)) {
        signalMap.set(signal.id, signal);
      }
    }
  }
  primary.signals = Array.from(signalMap.values());

  primary.contactCount = Math.max(...sorted.map((c) => c.contactCount));

  // Weighted average ICP: newest source gets 1.5x weight, others 1.0x
  if (sorted.length === 1) {
    primary.icpScore = sorted[0].icpScore;
  } else {
    let weightedSum = sorted[0].icpScore * 1.5;
    let totalWeight = 1.5;
    for (let i = 1; i < sorted.length; i++) {
      weightedSum += sorted[i].icpScore;
      totalWeight += 1.0;
    }
    primary.icpScore = Math.round(weightedSum / totalWeight);
  }

  for (const c of sorted) {
    if (!primary.revenue && c.revenue) primary.revenue = c.revenue;
    if (!primary.founded && c.founded) primary.founded = c.founded;
    if (!primary.phone && c.phone) primary.phone = c.phone;
    if (!primary.logoUrl && c.logoUrl) primary.logoUrl = c.logoUrl;
    if (!primary.description && c.description) primary.description = c.description;
  }

  return primary;
}

export function getSourceLabel(sources: ResultSource[]): string {
  if (sources.length <= 1) return "";
  const names: Record<ResultSource, string> = { exa: "Exa", apollo: "Apollo", hubspot: "HubSpot", clearout: "Clearout", mordor: "Mordor", freshsales: "Freshsales" };
  return "Found by " + sources.map((s) => names[s]).join(" + ");
}

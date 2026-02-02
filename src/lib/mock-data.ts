import type {
  CompanyRecord,
  CompanyEnriched,
  Contact,
  Signal,
  Exclusion,
  SearchPreset,
  AdminConfig,
  CompanyNote,
  ExportSettings,
  EmailVerificationSettings,
  ScoringSettings,
  RateLimitSettings,
  NotificationSettings,
  DataRetentionSettings,
  AuthSettings,
  AdminUiPreferences,
  EmailPromptsConfig,
  FreshsalesSettings,
} from "./types";

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// DB anchor records — what Supabase holds
// ---------------------------------------------------------------------------
export const mockCompanyAnchors: CompanyRecord[] = [
  { domain: "ingredion.com", name: "Ingredion", firstViewedBy: "Adi", firstViewedAt: daysAgo(30), lastViewedBy: "Satish", lastViewedAt: daysAgo(0), source: "exa", noteCount: 2, lastNoteAt: daysAgo(7), extractionCount: 1, lastExtractionAt: daysAgo(5), excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "tateandlyle.com", name: "Tate & Lyle", firstViewedBy: "Satish", firstViewedAt: daysAgo(20), lastViewedBy: "Satish", lastViewedAt: daysAgo(1), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "kerry.com", name: "Kerry Group", firstViewedBy: "Nikita", firstViewedAt: daysAgo(15), lastViewedBy: "Nikita", lastViewedAt: daysAgo(2), source: "apollo", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "basf.com", name: "BASF", firstViewedBy: "Adi", firstViewedAt: daysAgo(25), lastViewedBy: "Adi", lastViewedAt: daysAgo(3), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "evonik.com", name: "Evonik Industries", firstViewedBy: "Satish", firstViewedAt: daysAgo(10), lastViewedBy: "Satish", lastViewedAt: daysAgo(1), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "ashland.com", name: "Ashland Global", firstViewedBy: "Nikita", firstViewedAt: daysAgo(18), lastViewedBy: "Nikita", lastViewedAt: daysAgo(5), source: "apollo", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "lonza.com", name: "Lonza Group", firstViewedBy: "Nikita", firstViewedAt: daysAgo(12), lastViewedBy: "Nikita", lastViewedAt: daysAgo(0), source: "exa", noteCount: 1, lastNoteAt: daysAgo(3), extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "drreddys.com", name: "Dr. Reddy's Laboratories", firstViewedBy: "Adi", firstViewedAt: daysAgo(22), lastViewedBy: "Adi", lastViewedAt: daysAgo(7), source: "apollo", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "amcor.com", name: "Amcor", firstViewedBy: "Satish", firstViewedAt: daysAgo(14), lastViewedBy: "Satish", lastViewedAt: daysAgo(1), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "sealedair.com", name: "Sealed Air", firstViewedBy: "Nikita", firstViewedAt: daysAgo(16), lastViewedBy: "Nikita", lastViewedAt: daysAgo(4), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "corbion.com", name: "Corbion", firstViewedBy: "Adi", firstViewedAt: daysAgo(8), lastViewedBy: "Adi", lastViewedAt: daysAgo(0), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "givaudan.com", name: "Givaudan", firstViewedBy: "Satish", firstViewedAt: daysAgo(11), lastViewedBy: "Satish", lastViewedAt: daysAgo(2), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "dow.com", name: "Dow Chemical", firstViewedBy: "Adi", firstViewedAt: daysAgo(30), lastViewedBy: "Adi", lastViewedAt: daysAgo(10), source: "apollo", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "solvay.com", name: "Solvay", firstViewedBy: "Nikita", firstViewedAt: daysAgo(13), lastViewedBy: "Nikita", lastViewedAt: daysAgo(3), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "sunpharma.com", name: "Sun Pharma", firstViewedBy: "Adi", firstViewedAt: daysAgo(28), lastViewedBy: "Adi", lastViewedAt: daysAgo(14), source: "apollo", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "graphicpkg.com", name: "Graphic Packaging", firstViewedBy: "Satish", firstViewedAt: daysAgo(9), lastViewedBy: "Satish", lastViewedAt: daysAgo(2), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "iff.com", name: "IFF (International Flavors & Fragrances)", firstViewedBy: "Adi", firstViewedAt: daysAgo(20), lastViewedBy: "Adi", lastViewedAt: daysAgo(0), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "croda.com", name: "Croda International", firstViewedBy: "Nikita", firstViewedAt: daysAgo(7), lastViewedBy: "Nikita", lastViewedAt: daysAgo(1), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "cipla.com", name: "Cipla", firstViewedBy: "Adi", firstViewedAt: daysAgo(26), lastViewedBy: "Adi", lastViewedAt: daysAgo(20), source: "apollo", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "berryglobal.com", name: "Berry Global", firstViewedBy: "Satish", firstViewedAt: daysAgo(12), lastViewedBy: "Satish", lastViewedAt: daysAgo(3), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "adm.com", name: "ADM (Archer Daniels Midland)", firstViewedBy: "Adi", firstViewedAt: daysAgo(15), lastViewedBy: "Adi", lastViewedAt: daysAgo(0), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "symrise.com", name: "Symrise", firstViewedBy: "Satish", firstViewedAt: daysAgo(10), lastViewedBy: "Satish", lastViewedAt: daysAgo(2), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "clariant.com", name: "Clariant", firstViewedBy: "Nikita", firstViewedAt: daysAgo(14), lastViewedBy: "Nikita", lastViewedAt: daysAgo(5), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "biocon.com", name: "Biocon", firstViewedBy: "Adi", firstViewedAt: daysAgo(32), lastViewedBy: "Adi", lastViewedAt: daysAgo(30), source: "apollo", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
  { domain: "sonoco.com", name: "Sonoco Products", firstViewedBy: "Nikita", firstViewedAt: daysAgo(17), lastViewedBy: "Nikita", lastViewedAt: daysAgo(8), source: "exa", noteCount: 0, lastNoteAt: null, extractionCount: 0, lastExtractionAt: null, excluded: false, excludedBy: null, excludedAt: null, exclusionReason: null, status: "new", statusChangedBy: null, statusChangedAt: null, viewedBy: null },
];

// ---------------------------------------------------------------------------
// Cached enrichment per domain — what KV cache holds
// ---------------------------------------------------------------------------
export const mockEnrichmentCache: Record<string, {
  industry: string; vertical: string; employeeCount: number; location: string;
  region: string; description: string; icpScore: number; hubspotStatus: string;
  sources: string[]; contactCount: number; lastRefreshed: string;
  revenue?: string; founded?: string; phone?: string;
}> = {
  "ingredion.com": { industry: "Food Ingredients", vertical: "Food Ingredients", employeeCount: 12000, location: "Westchester, IL", region: "North America", description: "Global provider of ingredient solutions for food, beverage, and industrial markets.", icpScore: 92, hubspotStatus: "open", sources: ["exa", "apollo"], contactCount: 8, lastRefreshed: daysAgo(0), revenue: "$7.9B", founded: "1906" },
  "tateandlyle.com": { industry: "Food Ingredients", vertical: "Food Ingredients", employeeCount: 4200, location: "London, UK", region: "Europe", description: "Purpose-led food and beverage solutions company specializing in sweeteners and texturants.", icpScore: 88, hubspotStatus: "in_progress", sources: ["exa"], contactCount: 5, lastRefreshed: daysAgo(1), revenue: "$1.8B", founded: "1921" },
  "kerry.com": { industry: "Food Ingredients", vertical: "Food Ingredients", employeeCount: 23000, location: "Tralee, Ireland", region: "Europe", description: "Global taste and nutrition company delivering innovative solutions.", icpScore: 85, hubspotStatus: "new", sources: ["apollo", "hubspot"], contactCount: 6, lastRefreshed: daysAgo(2), revenue: "$8.5B", founded: "1972" },
  "basf.com": { industry: "Chemicals", vertical: "Chemicals", employeeCount: 111000, location: "Ludwigshafen, Germany", region: "Europe", description: "World's largest chemical producer, creating solutions for sustainable future.", icpScore: 78, hubspotStatus: "none", sources: ["exa", "apollo"], contactCount: 12, lastRefreshed: daysAgo(3), revenue: "$87.3B", founded: "1865" },
  "evonik.com": { industry: "Specialty Chemicals", vertical: "Chemicals", employeeCount: 33000, location: "Essen, Germany", region: "Europe", description: "Specialty chemicals company focused on health, nutrition, and resource efficiency.", icpScore: 75, hubspotStatus: "open", sources: ["exa"], contactCount: 4, lastRefreshed: daysAgo(1), revenue: "$18.5B", founded: "2007" },
  "ashland.com": { industry: "Specialty Chemicals", vertical: "Chemicals", employeeCount: 4200, location: "Wilmington, DE", region: "North America", description: "Global specialty chemicals company serving consumer and industrial markets.", icpScore: 71, hubspotStatus: "closed_won", sources: ["apollo", "hubspot"], contactCount: 3, lastRefreshed: daysAgo(5), revenue: "$2.1B", founded: "1924" },
  "lonza.com": { industry: "Pharma & Biotech", vertical: "Pharma", employeeCount: 17000, location: "Basel, Switzerland", region: "Europe", description: "Leading CDMO delivering integrated solutions for pharma and biotech.", icpScore: 82, hubspotStatus: "in_progress", sources: ["exa", "apollo", "hubspot"], contactCount: 7, lastRefreshed: daysAgo(0), revenue: "$6.2B", founded: "1897" },
  "drreddys.com": { industry: "Pharmaceuticals", vertical: "Pharma", employeeCount: 24000, location: "Hyderabad, India", region: "Asia Pacific", description: "Integrated pharmaceutical company committed to affordable and innovative medicines.", icpScore: 67, hubspotStatus: "new", sources: ["apollo"], contactCount: 5, lastRefreshed: daysAgo(7), revenue: "$3.2B", founded: "1984" },
  "amcor.com": { industry: "Packaging", vertical: "Packaging", employeeCount: 42500, location: "Zurich, Switzerland", region: "Europe", description: "Global leader in responsible packaging solutions across flexible and rigid formats.", icpScore: 80, hubspotStatus: "open", sources: ["exa", "apollo"], contactCount: 9, lastRefreshed: daysAgo(1), revenue: "$14.7B", founded: "1860" },
  "sealedair.com": { industry: "Packaging", vertical: "Packaging", employeeCount: 16500, location: "Charlotte, NC", region: "North America", description: "Protective and specialty packaging solutions for food safety and product protection.", icpScore: 73, hubspotStatus: "none", sources: ["exa"], contactCount: 4, lastRefreshed: daysAgo(4), revenue: "$5.5B", founded: "1960" },
  "corbion.com": { industry: "Food Ingredients", vertical: "Food Ingredients", employeeCount: 2800, location: "Amsterdam, Netherlands", region: "Europe", description: "Sustainable ingredient solutions for food preservation and biochemicals.", icpScore: 90, hubspotStatus: "new", sources: ["exa", "apollo"], contactCount: 4, lastRefreshed: daysAgo(0), revenue: "$1.5B", founded: "1919" },
  "givaudan.com": { industry: "Flavors & Fragrances", vertical: "Food Ingredients", employeeCount: 16800, location: "Vernier, Switzerland", region: "Europe", description: "Global leader in flavors, fragrances, and active cosmetic ingredients.", icpScore: 86, hubspotStatus: "in_progress", sources: ["exa"], contactCount: 6, lastRefreshed: daysAgo(2), revenue: "$7.1B", founded: "1895" },
  "dow.com": { industry: "Chemicals", vertical: "Chemicals", employeeCount: 36500, location: "Midland, MI", region: "North America", description: "Materials science leader delivering innovative and sustainable solutions.", icpScore: 65, hubspotStatus: "closed_lost", sources: ["apollo", "hubspot"], contactCount: 10, lastRefreshed: daysAgo(10), revenue: "$56.9B", founded: "1897" },
  "solvay.com": { industry: "Chemicals", vertical: "Chemicals", employeeCount: 22000, location: "Brussels, Belgium", region: "Europe", description: "Advanced materials and specialty chemicals powering cleaner mobility and more.", icpScore: 72, hubspotStatus: "open", sources: ["exa", "apollo"], contactCount: 5, lastRefreshed: daysAgo(3), revenue: "$13.4B", founded: "1863" },
  "sunpharma.com": { industry: "Pharmaceuticals", vertical: "Pharma", employeeCount: 40000, location: "Mumbai, India", region: "Asia Pacific", description: "World's fifth largest specialty generic pharmaceutical company.", icpScore: 58, hubspotStatus: "none", sources: ["apollo"], contactCount: 3, lastRefreshed: daysAgo(14), revenue: "$5.4B", founded: "1983" },
  "graphicpkg.com": { industry: "Packaging", vertical: "Packaging", employeeCount: 24000, location: "Atlanta, GA", region: "North America", description: "Sustainable consumer packaging solutions company serving food and beverage.", icpScore: 76, hubspotStatus: "new", sources: ["exa", "apollo"], contactCount: 5, lastRefreshed: daysAgo(2), revenue: "$9.4B", founded: "1992" },
  "iff.com": { industry: "Food Ingredients", vertical: "Food Ingredients", employeeCount: 22000, location: "New York, NY", region: "North America", description: "Global leader in food, beverage, health, biosciences, and scent.", icpScore: 89, hubspotStatus: "open", sources: ["exa", "apollo", "hubspot"], contactCount: 8, lastRefreshed: daysAgo(0), revenue: "$12.3B", founded: "1889" },
  "croda.com": { industry: "Specialty Chemicals", vertical: "Chemicals", employeeCount: 5800, location: "Snaith, UK", region: "Europe", description: "Smart science to improve lives — specialty chemicals for consumer and industrial markets.", icpScore: 83, hubspotStatus: "in_progress", sources: ["exa"], contactCount: 3, lastRefreshed: daysAgo(1), revenue: "$2.1B", founded: "1925" },
  "cipla.com": { industry: "Pharmaceuticals", vertical: "Pharma", employeeCount: 25000, location: "Mumbai, India", region: "Asia Pacific", description: "Global pharma company caring for life through affordable medicines.", icpScore: 55, hubspotStatus: "none", sources: ["apollo"], contactCount: 4, lastRefreshed: daysAgo(20), revenue: "$2.8B", founded: "1935" },
  "berryglobal.com": { industry: "Packaging", vertical: "Packaging", employeeCount: 46000, location: "Evansville, IN", region: "North America", description: "Leading provider of innovative, sustainable packaging and engineered products.", icpScore: 69, hubspotStatus: "open", sources: ["exa", "apollo"], contactCount: 7, lastRefreshed: daysAgo(3), revenue: "$13.9B", founded: "1967" },
  "adm.com": { industry: "Food Ingredients", vertical: "Food Ingredients", employeeCount: 42000, location: "Chicago, IL", region: "North America", description: "Global nutrition company and one of the world's largest agricultural processors.", icpScore: 91, hubspotStatus: "new", sources: ["exa", "hubspot"], contactCount: 10, lastRefreshed: daysAgo(0), revenue: "$101B", founded: "1902" },
  "symrise.com": { industry: "Flavors & Fragrances", vertical: "Food Ingredients", employeeCount: 11000, location: "Holzminden, Germany", region: "Europe", description: "Global supplier of fragrances, flavors, cosmetic actives and raw materials.", icpScore: 84, hubspotStatus: "open", sources: ["exa"], contactCount: 4, lastRefreshed: daysAgo(2), revenue: "$5.0B", founded: "2003" },
  "clariant.com": { industry: "Specialty Chemicals", vertical: "Chemicals", employeeCount: 11000, location: "Muttenz, Switzerland", region: "Europe", description: "Focused and innovative specialty chemical company based in Switzerland.", icpScore: 70, hubspotStatus: "none", sources: ["exa", "apollo"], contactCount: 3, lastRefreshed: daysAgo(5), revenue: "$5.3B", founded: "1995" },
  "biocon.com": { industry: "Biopharmaceuticals", vertical: "Pharma", employeeCount: 12000, location: "Bangalore, India", region: "Asia Pacific", description: "India's largest biopharmaceutical company focused on biosimilars and novel biologics.", icpScore: 48, hubspotStatus: "none", sources: ["apollo"], contactCount: 2, lastRefreshed: daysAgo(30), revenue: "$1.3B", founded: "1978" },
  "sonoco.com": { industry: "Packaging", vertical: "Packaging", employeeCount: 22000, location: "Hartsville, SC", region: "North America", description: "Diversified global packaging company providing a variety of consumer and industrial products.", icpScore: 62, hubspotStatus: "closed_lost", sources: ["exa"], contactCount: 4, lastRefreshed: daysAgo(8), revenue: "$7.3B", founded: "1899" },
};

// ---------------------------------------------------------------------------
// Cached signals per domain
// ---------------------------------------------------------------------------
export const mockSignalsCache: Record<string, Signal[]> = {
  "ingredion.com": [
    { id: "s1", companyDomain: "ingredion.com", type: "hiring", title: "Ingredion hiring VP of R&D", description: "New leadership role posted for ingredient innovation division.", date: daysAgo(2), sourceUrl: "https://linkedin.com/jobs/ingredion-vp-rd", source: "exa" },
    { id: "s2", companyDomain: "ingredion.com", type: "expansion", title: "Ingredion opens new plant in Mexico", description: "$120M investment in specialty ingredients manufacturing.", date: daysAgo(5), sourceUrl: "https://foodbusinessnews.net/ingredion-mexico", source: "exa" },
  ],
  "tateandlyle.com": [
    { id: "s3", companyDomain: "tateandlyle.com", type: "funding", title: "Tate & Lyle acquires Quantum Hi-Tech", description: "Strategic acquisition expands dietary fiber portfolio.", date: daysAgo(10), sourceUrl: null, source: "exa" },
  ],
  "kerry.com": [
    { id: "s4", companyDomain: "kerry.com", type: "news", title: "Kerry Group launches clean-label portfolio", description: "New range targeting plant-based and clean-label trends.", date: daysAgo(3), sourceUrl: "https://foodingredientsfirst.com/kerry-clean-label", source: "exa" },
  ],
  "basf.com": [
    { id: "s5", companyDomain: "basf.com", type: "hiring", title: "BASF recruiting sustainability team", description: "15 new positions in green chemistry division.", date: daysAgo(7), sourceUrl: null, source: "apollo" },
  ],
  "lonza.com": [
    { id: "s6", companyDomain: "lonza.com", type: "expansion", title: "Lonza expands biologics capacity", description: "New large-scale biologics facility in Visp, Switzerland.", date: daysAgo(1), sourceUrl: "https://lonza.com/news/visp-expansion", source: "exa" },
  ],
  "amcor.com": [
    { id: "s7", companyDomain: "amcor.com", type: "news", title: "Amcor commits to 100% recyclable packaging by 2025", description: "Bold sustainability pledge across all product lines.", date: daysAgo(14), sourceUrl: null, source: "exa" },
  ],
  "corbion.com": [
    { id: "s8", companyDomain: "corbion.com", type: "funding", title: "Corbion secures $200M green bond", description: "Funding earmarked for biobased ingredients expansion.", date: daysAgo(8), sourceUrl: "https://corbion.com/green-bond", source: "exa" },
  ],
  "givaudan.com": [
    { id: "s9", companyDomain: "givaudan.com", type: "hiring", title: "Givaudan expanding flavor innovation team", description: "20+ flavor chemist positions posted globally.", date: daysAgo(4), sourceUrl: null, source: "apollo" },
  ],
  "solvay.com": [
    { id: "s10", companyDomain: "solvay.com", type: "expansion", title: "Solvay opens innovation hub in Shanghai", description: "New R&D center focused on Asian market needs.", date: daysAgo(6), sourceUrl: null, source: "exa" },
  ],
  "graphicpkg.com": [
    { id: "s11", companyDomain: "graphicpkg.com", type: "news", title: "Graphic Packaging wins sustainability award", description: "Recognized for paperboard packaging innovations.", date: daysAgo(12), sourceUrl: null, source: "exa" },
  ],
  "iff.com": [
    { id: "s12", companyDomain: "iff.com", type: "hiring", title: "IFF building out bioscience division", description: "Major recruitment drive for enzymatic solutions team.", date: daysAgo(3), sourceUrl: null, source: "exa" },
    { id: "s13", companyDomain: "iff.com", type: "funding", title: "IFF completes DuPont Nutrition merger", description: "Creating $11B+ ingredient and bioscience powerhouse.", date: daysAgo(30), sourceUrl: null, source: "hubspot" },
  ],
  "croda.com": [
    { id: "s14", companyDomain: "croda.com", type: "expansion", title: "Croda invests in bio-based ingredients", description: "$100M commitment to sustainable raw materials.", date: daysAgo(9), sourceUrl: null, source: "exa" },
  ],
  "adm.com": [
    { id: "s15", companyDomain: "adm.com", type: "hiring", title: "ADM recruiting plant protein scientists", description: "Expansion of alternative protein research team.", date: daysAgo(2), sourceUrl: null, source: "exa" },
    { id: "s16", companyDomain: "adm.com", type: "expansion", title: "ADM opens new flavor creation center", description: "State-of-the-art facility in Cranbury, NJ.", date: daysAgo(15), sourceUrl: null, source: "exa" },
  ],
  "symrise.com": [
    { id: "s17", companyDomain: "symrise.com", type: "news", title: "Symrise partners with leading food tech startup", description: "Collaboration on next-gen natural sweeteners.", date: daysAgo(5), sourceUrl: null, source: "exa" },
  ],
  "berryglobal.com": [
    { id: "s18", companyDomain: "berryglobal.com", type: "hiring", title: "Berry Global expanding engineering team", description: "Hiring 30+ packaging engineers for sustainable solutions.", date: daysAgo(6), sourceUrl: null, source: "apollo" },
  ],
};

// ---------------------------------------------------------------------------
// Cached contacts per domain
// ---------------------------------------------------------------------------
export function confidenceLevel(score: number): "high" | "medium" | "low" | "none" {
  if (score >= 90) return "high";
  if (score >= 70) return "medium";
  if (score >= 50) return "low";
  return "none";
}

export const mockContactsCache: Record<string, Contact[]> = {
  "ingredion.com": [
    { id: "ct1", companyDomain: "ingredion.com", companyName: "Ingredion", firstName: "Sarah", lastName: "Chen", title: "VP of Procurement", email: "schen@ingredion.com", phone: "+1-708-551-2600", linkedinUrl: "https://linkedin.com/in/sarahchen", emailConfidence: 95, confidenceLevel: confidenceLevel(95), sources: ["apollo", "hubspot"], seniority: "vp", lastVerified: daysAgo(1) },
    { id: "ct2", companyDomain: "ingredion.com", companyName: "Ingredion", firstName: "Marcus", lastName: "Williams", title: "Director of Innovation", email: "mwilliams@ingredion.com", phone: null, linkedinUrl: "https://linkedin.com/in/marcuswilliams", emailConfidence: 88, confidenceLevel: confidenceLevel(88), sources: ["apollo"], seniority: "director", lastVerified: daysAgo(3) },
  ],
  "tateandlyle.com": [
    { id: "ct3", companyDomain: "tateandlyle.com", companyName: "Tate & Lyle", firstName: "Emma", lastName: "Thompson", title: "Head of Strategic Sourcing", email: "ethompson@tateandlyle.com", phone: "+44-20-7977-6000", linkedinUrl: null, emailConfidence: 82, confidenceLevel: confidenceLevel(82), sources: ["apollo"], seniority: "director", lastVerified: daysAgo(5) },
  ],
  "kerry.com": [
    { id: "ct4", companyDomain: "kerry.com", companyName: "Kerry Group", firstName: "Patrick", lastName: "O'Brien", title: "Chief Procurement Officer", email: "pobrien@kerry.com", phone: null, linkedinUrl: "https://linkedin.com/in/patrickobrien", emailConfidence: 91, confidenceLevel: confidenceLevel(91), sources: ["hubspot", "apollo"], seniority: "c_level", lastVerified: daysAgo(0) },
  ],
  "basf.com": [
    { id: "ct5", companyDomain: "basf.com", companyName: "BASF", firstName: "Klaus", lastName: "Muller", title: "SVP Nutrition & Health", email: "klaus.muller@basf.com", phone: "+49-621-60-0", linkedinUrl: "https://linkedin.com/in/klausmuller", emailConfidence: 76, confidenceLevel: confidenceLevel(76), sources: ["apollo"], seniority: "vp", lastVerified: daysAgo(10) },
  ],
  "evonik.com": [
    { id: "ct6", companyDomain: "evonik.com", companyName: "Evonik Industries", firstName: "Anna", lastName: "Schmidt", title: "Director of Business Development", email: "anna.schmidt@evonik.com", phone: null, linkedinUrl: null, emailConfidence: 70, confidenceLevel: confidenceLevel(70), sources: ["exa"], seniority: "director", lastVerified: daysAgo(14) },
  ],
  "lonza.com": [
    { id: "ct7", companyDomain: "lonza.com", companyName: "Lonza Group", firstName: "Jean-Pierre", lastName: "Dubois", title: "CEO", email: "jpdubois@lonza.com", phone: "+41-61-316-81-11", linkedinUrl: "https://linkedin.com/in/jpdubois", emailConfidence: 97, confidenceLevel: confidenceLevel(97), sources: ["apollo", "hubspot", "exa"], seniority: "c_level", lastVerified: daysAgo(0) },
    { id: "ct8", companyDomain: "lonza.com", companyName: "Lonza Group", firstName: "Mei", lastName: "Wang", title: "VP of Sales APAC", email: "mwang@lonza.com", phone: null, linkedinUrl: "https://linkedin.com/in/meiwang", emailConfidence: 84, confidenceLevel: confidenceLevel(84), sources: ["apollo"], seniority: "vp", lastVerified: daysAgo(7) },
  ],
  "drreddys.com": [
    { id: "ct9", companyDomain: "drreddys.com", companyName: "Dr. Reddy's Laboratories", firstName: "Priya", lastName: "Sharma", title: "Head of International Business", email: "psharma@drreddys.com", phone: "+91-40-4900-2900", linkedinUrl: null, emailConfidence: 65, confidenceLevel: confidenceLevel(65), sources: ["apollo"], seniority: "director", lastVerified: daysAgo(20) },
  ],
  "amcor.com": [
    { id: "ct10", companyDomain: "amcor.com", companyName: "Amcor", firstName: "Michael", lastName: "Torres", title: "Chief Commercial Officer", email: "mtorres@amcor.com", phone: null, linkedinUrl: "https://linkedin.com/in/michaeltorres", emailConfidence: 93, confidenceLevel: confidenceLevel(93), sources: ["apollo", "hubspot"], seniority: "c_level", lastVerified: daysAgo(1) },
    { id: "ct11", companyDomain: "amcor.com", companyName: "Amcor", firstName: "Lisa", lastName: "Park", title: "Director of Sustainability", email: "lpark@amcor.com", phone: "+1-224-313-7000", linkedinUrl: null, emailConfidence: 79, confidenceLevel: confidenceLevel(79), sources: ["exa"], seniority: "director", lastVerified: daysAgo(12) },
  ],
  "corbion.com": [
    { id: "ct12", companyDomain: "corbion.com", companyName: "Corbion", firstName: "Jan", lastName: "de Vries", title: "VP of Sales Europe", email: "jdevries@corbion.com", phone: null, linkedinUrl: "https://linkedin.com/in/jandevries", emailConfidence: 88, confidenceLevel: confidenceLevel(88), sources: ["apollo"], seniority: "vp", lastVerified: daysAgo(4) },
  ],
  "givaudan.com": [
    { id: "ct13", companyDomain: "givaudan.com", companyName: "Givaudan", firstName: "Sophie", lastName: "Martin", title: "Head of Flavor Creation", email: "smartin@givaudan.com", phone: "+41-22-780-91-11", linkedinUrl: "https://linkedin.com/in/sophiemartin", emailConfidence: 86, confidenceLevel: confidenceLevel(86), sources: ["apollo", "exa"], seniority: "director", lastVerified: daysAgo(6) },
  ],
  "dow.com": [
    { id: "ct14", companyDomain: "dow.com", companyName: "Dow Chemical", firstName: "Robert", lastName: "Anderson", title: "President, Packaging Division", email: null, phone: "+1-989-636-1000", linkedinUrl: "https://linkedin.com/in/robertanderson", emailConfidence: 0, confidenceLevel: "none", sources: ["hubspot"], seniority: "vp", lastVerified: null },
  ],
  "solvay.com": [
    { id: "ct15", companyDomain: "solvay.com", companyName: "Solvay", firstName: "Marie", lastName: "Laurent", title: "Director of Business Development", email: "mlaurent@solvay.com", phone: null, linkedinUrl: null, emailConfidence: 72, confidenceLevel: confidenceLevel(72), sources: ["apollo"], seniority: "director", lastVerified: daysAgo(8) },
  ],
  "graphicpkg.com": [
    { id: "ct16", companyDomain: "graphicpkg.com", companyName: "Graphic Packaging", firstName: "David", lastName: "Mitchell", title: "SVP of Operations", email: "dmitchell@graphicpkg.com", phone: "+1-770-240-7200", linkedinUrl: "https://linkedin.com/in/davidmitchell", emailConfidence: 90, confidenceLevel: confidenceLevel(90), sources: ["apollo", "hubspot"], seniority: "vp", lastVerified: daysAgo(2) },
  ],
  "iff.com": [
    { id: "ct17", companyDomain: "iff.com", companyName: "IFF", firstName: "James", lastName: "Rivera", title: "Chief Innovation Officer", email: "jrivera@iff.com", phone: null, linkedinUrl: "https://linkedin.com/in/jamesrivera", emailConfidence: 94, confidenceLevel: confidenceLevel(94), sources: ["apollo", "hubspot", "exa"], seniority: "c_level", lastVerified: daysAgo(0) },
    { id: "ct18", companyDomain: "iff.com", companyName: "IFF", firstName: "Rachel", lastName: "Kim", title: "Director of Strategic Accounts", email: "rkim@iff.com", phone: "+1-212-765-5500", linkedinUrl: null, emailConfidence: 81, confidenceLevel: confidenceLevel(81), sources: ["apollo"], seniority: "director", lastVerified: daysAgo(5) },
  ],
  "croda.com": [
    { id: "ct19", companyDomain: "croda.com", companyName: "Croda International", firstName: "Oliver", lastName: "Hughes", title: "VP of Innovation", email: "ohughes@croda.com", phone: null, linkedinUrl: "https://linkedin.com/in/oliverhughes", emailConfidence: 77, confidenceLevel: confidenceLevel(77), sources: ["exa"], seniority: "vp", lastVerified: daysAgo(9) },
  ],
  "berryglobal.com": [
    { id: "ct20", companyDomain: "berryglobal.com", companyName: "Berry Global", firstName: "Jennifer", lastName: "Adams", title: "Director of Procurement", email: "jadams@berryglobal.com", phone: "+1-812-424-2904", linkedinUrl: "https://linkedin.com/in/jenniferadams", emailConfidence: 85, confidenceLevel: confidenceLevel(85), sources: ["apollo"], seniority: "director", lastVerified: daysAgo(3) },
  ],
  "adm.com": [
    { id: "ct21", companyDomain: "adm.com", companyName: "ADM", firstName: "Thomas", lastName: "Baker", title: "President, Nutrition Division", email: "tbaker@adm.com", phone: null, linkedinUrl: "https://linkedin.com/in/thomasbaker", emailConfidence: 92, confidenceLevel: confidenceLevel(92), sources: ["apollo", "hubspot"], seniority: "vp", lastVerified: daysAgo(1) },
    { id: "ct22", companyDomain: "adm.com", companyName: "ADM", firstName: "Linda", lastName: "Zhang", title: "Head of Plant Protein R&D", email: "lzhang@adm.com", phone: "+1-312-634-8100", linkedinUrl: null, emailConfidence: 78, confidenceLevel: confidenceLevel(78), sources: ["exa"], seniority: "director", lastVerified: daysAgo(7) },
  ],
  "symrise.com": [
    { id: "ct23", companyDomain: "symrise.com", companyName: "Symrise", firstName: "Friedrich", lastName: "Weber", title: "Managing Director, Flavor Division", email: "fweber@symrise.com", phone: null, linkedinUrl: "https://linkedin.com/in/friedrichweber", emailConfidence: 83, confidenceLevel: confidenceLevel(83), sources: ["apollo"], seniority: "director", lastVerified: daysAgo(6) },
  ],
  "clariant.com": [
    { id: "ct24", companyDomain: "clariant.com", companyName: "Clariant", firstName: "Elena", lastName: "Rossi", title: "VP of Specialty Ingredients", email: null, phone: null, linkedinUrl: "https://linkedin.com/in/elenarossi", emailConfidence: 0, confidenceLevel: "none", sources: ["exa"], seniority: "vp", lastVerified: null },
  ],
  "sonoco.com": [
    { id: "ct25", companyDomain: "sonoco.com", companyName: "Sonoco Products", firstName: "William", lastName: "Harris", title: "Director of Sustainable Packaging", email: "wharris@sonoco.com", phone: "+1-843-383-7000", linkedinUrl: null, emailConfidence: 68, confidenceLevel: confidenceLevel(68), sources: ["apollo"], seniority: "director", lastVerified: daysAgo(15) },
  ],
};

// ---------------------------------------------------------------------------
// Pre-merged enriched companies for dev display
// ---------------------------------------------------------------------------
export const mockCompaniesEnriched: CompanyEnriched[] = mockCompanyAnchors.map((anchor) => {
  const enrichment = mockEnrichmentCache[anchor.domain];
  const signals = mockSignalsCache[anchor.domain] ?? [];
  if (!enrichment) {
    return {
      ...anchor,
      industry: "", vertical: "", employeeCount: 0, location: "", region: "",
      description: "", icpScore: 0, hubspotStatus: "none" as const,
      freshsalesStatus: "none" as const, freshsalesIntel: null,
      sources: [], signals: [], contactCount: 0, lastRefreshed: anchor.lastViewedAt,
    };
  }
  return {
    ...anchor,
    ...enrichment,
    hubspotStatus: enrichment.hubspotStatus as CompanyEnriched["hubspotStatus"],
    freshsalesStatus: "none" as const,
    freshsalesIntel: null,
    sources: enrichment.sources as CompanyEnriched["sources"],
    signals,
  };
});

// ---------------------------------------------------------------------------
// Exclusions, presets, admin config, notes (unchanged shape)
// ---------------------------------------------------------------------------
export const mockExclusions: Exclusion[] = [
  { id: "ex1", type: "company", value: "Competitor Corp", reason: "Direct competitor", addedBy: "Adi", addedAt: daysAgo(30), source: "manual" },
  { id: "ex2", type: "domain", value: "spamcompany.com", reason: "Known spam domain", addedBy: "Satish", addedAt: daysAgo(20), source: "manual" },
  { id: "ex3", type: "email", value: "noreply@generic.com", reason: "Generic inbox", addedBy: "Adi", addedAt: daysAgo(15), source: "manual" },
];

export const mockPresets: SearchPreset[] = [
  {
    id: "sp1", name: "High-Value Food Ingredients",
    filters: { sources: ["exa", "apollo"], verticals: ["Food Ingredients"], regions: [], sizes: ["201-1000", "1000+"], signals: [], statuses: [], hideExcluded: true, quickFilters: ["high_icp"] },
    createdBy: "Adi", createdAt: daysAgo(60), updatedAt: daysAgo(10),
  },
  {
    id: "sp2", name: "European Chemicals",
    filters: { sources: ["exa"], verticals: ["Chemicals"], regions: ["Europe"], sizes: [], signals: [], statuses: [], hideExcluded: true, quickFilters: [] },
    createdBy: "Satish", createdAt: daysAgo(45), updatedAt: daysAgo(45),
  },
  {
    id: "sp3", name: "Signal-Rich Targets",
    filters: { sources: [], verticals: [], regions: [], sizes: [], signals: ["hiring", "funding", "expansion"], statuses: [], hideExcluded: true, quickFilters: ["has_signals"] },
    createdBy: "Nikita", createdAt: daysAgo(30), updatedAt: daysAgo(5),
  },
];

export const defaultExportSettings: ExportSettings = {
  defaultFormat: "csv",
  csvColumns: ["name", "email", "title", "company", "phone", "confidence"],
  confidenceThreshold: 50,
  autoVerifyOnExport: false,
  includeCompanyContext: true,
};

export const defaultEmailVerification: EmailVerificationSettings = {
  clearoutThreshold: 70,
  autoVerifyAboveConfidence: 90,
  dailyMaxVerifications: 500,
  verifyOnContactLoad: false,
  emailFinderEnabled: true,
  emailFinderMaxPerBatch: 10,
  emailFinderMinConfidenceToSkip: 70,
};

export const defaultScoringSettings: ScoringSettings = {
  displayThreshold: 0,
  perSourceConfidence: { exa: 80, apollo: 90, hubspot: 85, freshsales: 75 },
  stalenessDecayDays: 30,
  stalenessDecayPercent: 10,
};

export const defaultRateLimits: RateLimitSettings = {
  perSource: {
    exa: { maxPerMin: 60, warningAt: 50 },
    apollo: { maxPerMin: 100, warningAt: 80 },
    hubspot: { maxPerMin: 100, warningAt: 80 },
    clearout: { maxPerMin: 20, warningAt: 15 },
    freshsales: { maxPerMin: 60, warningAt: 50 },
  },
  slackWebhookUrl: null,
  alertRecipients: [],
};

export const defaultNotifications: NotificationSettings = {
  dailyDigest: false,
  digestRecipients: [],
  slackWebhookUrl: null,
  alertOnRateLimit: true,
  alertOnKeyExpiry: true,
};

export const defaultDataRetention: DataRetentionSettings = {
  cachePurgeIntervalHours: 24,
  searchHistoryRetentionDays: 90,
  extractionLogRetentionDays: 180,
  autoPurge: false,
};

export const defaultAuthSettings: AuthSettings = {
  sessionTimeoutMinutes: 480,
  welcomeMessage: "Welcome to myRA Sales Navigator",
  sessionDurationDays: 30,
  magicLinkExpiryMinutes: 60,
};

export const defaultUiPreferences: AdminUiPreferences = {
  defaultPanelWidths: { left: 280, right: 400 },
  defaultViewMode: "companies",
  autoRefreshIntervalMin: 0,
  showConfidenceBadges: true,
  compactMode: false,
};

export const defaultEmailPrompts: EmailPromptsConfig = {
  companyDescription: "a technology company",
  valueProposition: "",
  toneInstructions: {
    formal: "Use professional language. Address by Mr./Ms. + last name. Structured paragraphs.",
    casual: "Conversational and warm. First name basis. Short sentences. Friendly but not unprofessional.",
    direct: "Ultra-concise. Get to value prop in the first sentence. No small talk. Under 100 words.",
  },
  templateInstructions: {
    intro: "This is a first-touch cold email. The prospect has never heard from us. Lead with a relevant insight about their company, connect it to how we can help, and end with a soft CTA (e.g., 'Worth a quick chat?').",
    follow_up: "This is a follow-up to a previous outreach that got no response. Reference the previous attempt briefly, add new value (a new insight or resource), and make the CTA even softer.",
    re_engagement: "This is a re-engagement email to someone we've spoken with before but the conversation went cold. Reference the previous interaction, share something new and relevant, and suggest reconnecting.",
  },
  systemPromptSuffix: "",
  defaultTone: "direct",
  defaultTemplate: "intro",
};

export const defaultFreshsalesSettings: FreshsalesSettings = {
  enabled: true,
  domain: "mordorintelligence",
  sectionTitle: "Research Team Intel",
  emptyStateLabel: "Not engaged by research team",
  statusLabels: {
    none: "Not Engaged",
    new_lead: "In Research Pipeline",
    contacted: "Research Team Contacted",
    negotiation: "Research Deal Active",
    won: "Research Customer",
    customer: "Research Customer",
    lost: "Research Deal Lost",
  },
  showDeals: true,
  showContacts: true,
  showActivity: true,
  recentActivityDaysThreshold: 30,
  cacheTtlMinutes: 30,
  icpWeights: {
    freshsalesLead: 10,
    freshsalesCustomer: -40,
    freshsalesRecentContact: 15,
  },
};

export const defaultAdminConfig: AdminConfig = {
  icpWeights: {
    verticalMatch: 25, sizeMatch: 20, regionMatch: 15, buyingSignals: 15,
    negativeSignals: -10, exaRelevance: 10, hubspotLead: 10, hubspotCustomer: 5,
    freshsalesLead: 10, freshsalesCustomer: -40, freshsalesRecentContact: 15,
  },
  verticals: ["Food Ingredients", "Chemicals", "Pharma", "Packaging", "Flavors & Fragrances", "Specialty Chemicals", "Biopharmaceuticals"],
  sizeSweetSpot: { min: 200, max: 50000 },
  signalTypes: [
    { type: "hiring", enabled: true },
    { type: "funding", enabled: true },
    { type: "expansion", enabled: true },
    { type: "news", enabled: true },
  ],
  teamMembers: [
    { name: "Adi", email: "adi@ask-myra.ai", isAdmin: true },
    { name: "JVS", email: "jvs@ask-myra.ai", isAdmin: true },
    { name: "Reddy", email: "reddy@ask-myra.ai", isAdmin: true },
    { name: "Sai", email: "sai@ask-myra.ai", isAdmin: true },
    { name: "Satish", email: "satish@ask-myra.ai", isAdmin: false },
    { name: "Sudeshana", email: "sudeshana@ask-myra.ai", isAdmin: false },
    { name: "Kirandeep", email: "kirandeep@ask-myra.ai", isAdmin: false },
    { name: "Nikita", email: "nikita@ask-myra.ai", isAdmin: false },
    { name: "Asim", email: "asim@ask-myra.ai", isAdmin: false },
    { name: "Satyananth", email: "satyananth@ask-myra.ai", isAdmin: false },
    { name: "Aditya Prasad", email: "adityaprasad@ask-myra.ai", isAdmin: false },
    { name: "Vijay Ravi", email: "vijayravi@ask-myra.ai", isAdmin: false },
  ],
  cacheDurations: { exa: 60, apollo: 120, hubspot: 30, clearout: 1440, freshsales: 30 },
  copyFormats: [
    { id: "cf1", name: "Standard", template: "{name} <{email}> - {title} at {company}" },
    { id: "cf2", name: "Email Only", template: "{email}" },
    { id: "cf3", name: "Full Detail", template: "{name}\n{title} at {company}\n{email}\n{phone}" },
  ],
  defaultCopyFormat: "cf1",
  apiKeys: [],
  dataSources: [],
  exportSettings: defaultExportSettings,
  emailVerification: defaultEmailVerification,
  scoringSettings: defaultScoringSettings,
  rateLimits: defaultRateLimits,
  notifications: defaultNotifications,
  dataRetention: defaultDataRetention,
  authSettings: defaultAuthSettings,
  uiPreferences: defaultUiPreferences,
  emailPrompts: defaultEmailPrompts,
  analyticsSettings: { kpiTargets: { exportsThisWeek: 20, avgIcpScore: 60 } },
  freshsalesSettings: defaultFreshsalesSettings,
  authLog: [],
  authRequests: [],
};

export const mockNotes: CompanyNote[] = [
  { id: "n1", companyDomain: "ingredion.com", content: "Met with procurement team at FiE 2024. Strong interest in our solutions.", authorName: "Adi", createdAt: daysAgo(15), updatedAt: null, mentions: [] },
  { id: "n2", companyDomain: "ingredion.com", content: "Follow up scheduled for Q1. Sarah Chen is the key decision maker.", authorName: "Satish", createdAt: daysAgo(7), updatedAt: null, mentions: [] },
  { id: "n3", companyDomain: "lonza.com", content: "Lonza is expanding rapidly. Good timing for outreach.", authorName: "Nikita", createdAt: daysAgo(3), updatedAt: null, mentions: [] },
];

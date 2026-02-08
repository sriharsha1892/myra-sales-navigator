import type { CompanyEnriched, IcpWeights, Signal } from "./types";

export interface IcpBreakdownItem {
  factor: string;
  points: number;
  matched: boolean;
}

export interface IcpScoreResult {
  score: number;
  breakdown: IcpBreakdownItem[];
}

interface ScoringContext {
  verticals: string[];
  regions: string[];
  sizes: string[]; // e.g. ["51-200", "201-1000"]
  signals: string[];
}

const DEFAULT_WEIGHTS: IcpWeights = {
  verticalMatch: 30,
  sizeMatch: 20,
  regionMatch: 10,
  buyingSignals: 20,
  negativeSignals: -30,
  exaRelevance: 10,
  hubspotLead: 15,
  hubspotCustomer: -50,
  freshsalesLead: 10,
  freshsalesCustomer: -40,
  freshsalesRecentContact: 5,
  freshsalesTagBoost: 15,
  freshsalesTagPenalty: -20,
  freshsalesDealStalled: -10,
};

function sizeMatchesBucket(employeeCount: number, bucket: string): boolean {
  switch (bucket) {
    case "1-50": return employeeCount >= 1 && employeeCount <= 50;
    case "51-200": return employeeCount >= 51 && employeeCount <= 200;
    case "201-1000": return employeeCount >= 201 && employeeCount <= 1000;
    case "1000+": return employeeCount >= 1000;
    default: return false;
  }
}

const NEGATIVE_SIGNAL_KEYWORDS = ["layoff", "downsizing", "restructuring", "bankruptcy"];

function hasNegativeSignals(signals: Signal[]): boolean {
  return signals.some((s) => {
    const text = `${s.title} ${s.description}`.toLowerCase();
    return NEGATIVE_SIGNAL_KEYWORDS.some((kw) => text.includes(kw));
  });
}

export function calculateIcpScore(
  company: CompanyEnriched,
  weights?: Partial<IcpWeights>,
  context?: Partial<ScoringContext>
): IcpScoreResult {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const ctx: ScoringContext = {
    verticals: context?.verticals ?? [],
    regions: context?.regions ?? [],
    sizes: context?.sizes ?? [],
    signals: context?.signals ?? [],
  };

  const breakdown: IcpBreakdownItem[] = [];

  // 1. Vertical match
  const verticalMatched = ctx.verticals.length > 0 &&
    (ctx.verticals.some((v) =>
      company.vertical?.toLowerCase().includes(v.toLowerCase()) ||
      company.industry?.toLowerCase().includes(v.toLowerCase())
    ));
  breakdown.push({
    factor: verticalMatched ? `Vertical: ${company.vertical || company.industry}` : "Vertical match",
    points: verticalMatched ? w.verticalMatch : 0,
    matched: verticalMatched,
  });

  // 2. Size match
  const sizeMatched = ctx.sizes.length > 0 && company.employeeCount > 0 &&
    ctx.sizes.some((bucket) => sizeMatchesBucket(company.employeeCount, bucket));
  breakdown.push({
    factor: sizeMatched ? `Size: ${company.employeeCount?.toLocaleString()} emp` : "Size match",
    points: sizeMatched ? w.sizeMatch : 0,
    matched: sizeMatched,
  });

  // 3. Region match
  const regionMatched = ctx.regions.length > 0 &&
    ctx.regions.some((r) =>
      company.region?.toLowerCase().includes(r.toLowerCase()) ||
      company.location?.toLowerCase().includes(r.toLowerCase())
    );
  breakdown.push({
    factor: regionMatched ? `Region: ${company.region || company.location}` : "Region match",
    points: regionMatched ? w.regionMatch : 0,
    matched: regionMatched,
  });

  // 4. Buying signals (hiring, funding, expansion)
  const buyingSignalTypes = ["hiring", "funding", "expansion"];
  const hasBuyingSignals = company.signals.some((s) => buyingSignalTypes.includes(s.type));
  breakdown.push({
    factor: hasBuyingSignals ? `Signals: ${company.signals.map((s) => s.type).filter((t) => buyingSignalTypes.includes(t)).join(", ")}` : "Buying signals",
    points: hasBuyingSignals ? w.buyingSignals : 0,
    matched: hasBuyingSignals,
  });

  // 5. Negative signals
  const hasNegative = hasNegativeSignals(company.signals);
  if (hasNegative) {
    breakdown.push({
      factor: "Negative signals detected",
      points: w.negativeSignals,
      matched: true,
    });
  }

  // 6. Exa relevance — scale bonus by actual Exa relevance score (0-1)
  const hasExa = company.sources.includes("exa");
  if (hasExa) {
    const relevance = company.exaRelevanceScore ?? 0.5;
    const scaledPoints = Math.round(w.exaRelevance * relevance);
    breakdown.push({
      factor: `Exa relevance: ${Math.round(relevance * 100)}%`,
      points: scaledPoints,
      matched: scaledPoints > 0,
    });
  }

  // 7. HubSpot status
  if (company.hubspotStatus && company.hubspotStatus !== "none") {
    const isCustomer = company.hubspotStatus === "closed_won";
    const isLead = ["new", "open", "in_progress"].includes(company.hubspotStatus);
    if (isCustomer) {
      breakdown.push({
        factor: "HubSpot: existing customer",
        points: w.hubspotCustomer,
        matched: true,
      });
    } else if (isLead) {
      breakdown.push({
        factor: "HubSpot: active lead",
        points: w.hubspotLead,
        matched: true,
      });
    }
  }

  // 8. Freshsales status
  if (company.freshsalesStatus && company.freshsalesStatus !== "none") {
    const isCustomer = company.freshsalesStatus === "customer" || company.freshsalesStatus === "won";
    const isLead = ["new_lead", "contacted", "negotiation"].includes(company.freshsalesStatus);
    if (isCustomer) {
      breakdown.push({
        factor: "Freshsales: existing customer",
        points: w.freshsalesCustomer,
        matched: true,
      });
    } else if (isLead) {
      breakdown.push({
        factor: "Freshsales: active lead",
        points: w.freshsalesLead,
        matched: true,
      });
    }
  }

  // 8b. Freshsales contact tags
  if (company.freshsalesIntel?.contacts?.length) {
    const allTags = company.freshsalesIntel.contacts.flatMap((c) => c.tags || []);
    const hasBoostTag = allTags.some((t) =>
      ["decision maker", "champion", "key contact"].includes(t.toLowerCase())
    );
    const hasPenaltyTag = allTags.some((t) =>
      ["churned", "bad fit", "competitor"].includes(t.toLowerCase())
    );
    if (hasBoostTag) {
      breakdown.push({
        factor: "Freshsales: positive contact tag",
        points: w.freshsalesTagBoost,
        matched: true,
      });
    }
    if (hasPenaltyTag) {
      breakdown.push({
        factor: "Freshsales: negative contact tag",
        points: w.freshsalesTagPenalty,
        matched: true,
      });
    }
  }

  // 8c. Freshsales deal velocity (stalled deal penalty)
  if (company.freshsalesIntel?.deals?.length) {
    const stalledDeal = company.freshsalesIntel.deals.find(
      (d) =>
        d.daysInStage != null &&
        d.daysInStage > 30 &&
        !["won", "lost", "closed won", "closed lost"].includes(d.stage.toLowerCase())
    );
    if (stalledDeal) {
      breakdown.push({
        factor: `Freshsales: deal stalled ${stalledDeal.daysInStage}d`,
        points: w.freshsalesDealStalled,
        matched: true,
      });
    }
  }

  // Calculate total, clamp 0-100
  const rawScore = breakdown.reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  // Sort: positives first (desc), then negatives
  breakdown.sort((a, b) => {
    if (a.points > 0 && b.points <= 0) return -1;
    if (a.points <= 0 && b.points > 0) return 1;
    return Math.abs(b.points) - Math.abs(a.points);
  });

  return { score, breakdown };
}

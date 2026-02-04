import type {
  GtmOrg,
  GtmEntry,
  OrgSnapshot,
  CostItem,
  EntryDeltas,
  GtmV2Segment,
} from "./v2-types";
import { ALL_V2_SEGMENTS } from "./v2-types";

/** Build a frozen snapshot of org counts/names from current org list */
export function buildOrgSnapshot(orgs: GtmOrg[]): OrgSnapshot {
  const counts = {} as Record<GtmV2Segment, number>;
  const names = {} as Record<GtmV2Segment, string[]>;

  for (const s of ALL_V2_SEGMENTS) {
    counts[s] = 0;
    names[s] = [];
  }

  let totalCost = 0;
  let totalUsers = 0;
  let totalConversations = 0;

  for (const org of orgs) {
    const seg = org.segment;
    counts[seg] = (counts[seg] ?? 0) + 1;
    names[seg] = names[seg] ?? [];
    names[seg].push(org.name);
    totalCost += org.costUsd;
    totalUsers += org.users;
    totalConversations += org.conversations;
  }

  return { counts, names, totalCost, totalUsers, totalConversations };
}

/** Build snapshot from direct edits (no org CRUD) */
export function buildSnapshotFromEdits(
  names: Record<GtmV2Segment, string[]>,
  costItems: CostItem[]
): OrgSnapshot {
  const counts = {} as Record<GtmV2Segment, number>;
  for (const s of ALL_V2_SEGMENTS) {
    counts[s] = names[s]?.length ?? 0;
  }

  let totalCost = 0;
  let totalUsers = 0;
  let totalConversations = 0;
  for (const item of costItems) {
    totalCost += item.costUsd;
    totalUsers += item.users;
    totalConversations += item.conversations ?? 0;
  }

  return { counts, names, totalCost, totalUsers, totalConversations, costItems };
}

/** Compute deltas between current and previous entry */
export function computeDeltas(
  current: GtmEntry,
  previous: GtmEntry | null,
  currentOrgs: GtmOrg[]
): EntryDeltas {
  const prevSnap = previous?.orgSnapshot;
  const currSnap = current.orgSnapshot;

  const orgsBySegment: Record<string, GtmOrg[]> = {};
  for (const org of currentOrgs) {
    if (!orgsBySegment[org.segment]) orgsBySegment[org.segment] = [];
    orgsBySegment[org.segment].push(org);
  }

  return {
    segments: ALL_V2_SEGMENTS.map((seg) => ({
      segment: seg,
      current: currSnap?.counts?.[seg] ?? 0,
      previous: prevSnap?.counts?.[seg] ?? 0,
      delta: (currSnap?.counts?.[seg] ?? 0) - (prevSnap?.counts?.[seg] ?? 0),
      currentNames: currSnap?.names?.[seg] ?? [],
    })),
    leadGen: {
      inboundTotal: current.inboundTotal - (previous?.inboundTotal ?? 0),
      inboundActive: current.inboundActive - (previous?.inboundActive ?? 0),
      outboundLeads: current.outboundLeads - (previous?.outboundLeads ?? 0),
      outboundQualified: current.outboundQualified - (previous?.outboundQualified ?? 0),
      apolloContacts: current.apolloContacts - (previous?.apolloContacts ?? 0),
    },
    totalCost: current.totalCostUsd - (previous?.totalCostUsd ?? 0),
  };
}

/** Parse numeric input, defaulting to 0 */
export function parseNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === "") return 0;
  const n = typeof val === "string" ? Number(val) : val;
  return Number.isFinite(n) ? n : 0;
}

/** Format a date as "Feb 3, 2026" */
export function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Compute which orgs moved between segments */
export function computeOrgMovements(
  current: OrgSnapshot,
  previous: OrgSnapshot
): Record<GtmV2Segment, { added: string[]; removed: string[] }> {
  const result = {} as Record<GtmV2Segment, { added: string[]; removed: string[] }>;
  for (const seg of ALL_V2_SEGMENTS) {
    const curr = new Set(current.names?.[seg] ?? []);
    const prev = new Set(previous.names?.[seg] ?? []);
    result[seg] = {
      added: [...curr].filter((n) => !prev.has(n)),
      removed: [...prev].filter((n) => !curr.has(n)),
    };
  }
  return result;
}

/** Build a full text summary for pasting into Teams */
export function buildTeamsSummary(
  latest: GtmEntry,
  previous: GtmEntry | null
): string {
  const snap = latest.orgSnapshot;
  const prevSnap = previous?.orgSnapshot;
  const lines: string[] = [];

  lines.push(`GTM Catchup — ${formatEntryDate(latest.entryDate)}`);
  if (previous) {
    lines.push(`Changes since ${formatEntryDate(previous.entryDate)}`);
  }
  lines.push("");

  // KPIs
  const paying = snap?.counts?.paying ?? 0;
  const prospects = snap?.counts?.prospect ?? 0;
  const trials = snap?.counts?.trial ?? 0;
  const active = paying + prospects + trials;
  const prevPaying = prevSnap?.counts?.paying ?? 0;
  const prevProspects = prevSnap?.counts?.prospect ?? 0;
  const prevActive = prevPaying + (prevSnap?.counts?.prospect ?? 0) + (prevSnap?.counts?.trial ?? 0);

  const delta = (curr: number, prev: number) => {
    const d = curr - prev;
    if (!previous || d === 0) return "";
    return ` (${d > 0 ? "+" : ""}${d})`;
  };

  lines.push("📊 KPIs");
  lines.push(`Paying: ${paying}${delta(paying, prevPaying)}  |  Prospects: ${prospects}${delta(prospects, prevProspects)}  |  Active: ${active}${delta(active, prevActive)}`);
  lines.push("");

  // Pipeline
  lines.push("📈 Pipeline");
  const pipelineSegs: { seg: GtmV2Segment; label: string }[] = [
    { seg: "trial", label: "Trial" },
    { seg: "post_demo", label: "Post-Demo" },
    { seg: "demo_queued", label: "Demo Queued" },
    { seg: "dormant", label: "Dormant" },
    { seg: "lost", label: "Lost" },
    { seg: "early", label: "Early" },
  ];
  const pipelineParts = pipelineSegs.map(({ seg, label }) => {
    const c = snap?.counts?.[seg] ?? 0;
    const p = prevSnap?.counts?.[seg] ?? 0;
    return `${label}: ${c}${delta(c, p)}`;
  });
  lines.push(pipelineParts.join("  |  "));
  lines.push("");

  // Lead Gen
  lines.push("📥 Lead Gen");
  lines.push(`Inbound: ${latest.inboundTotal} total, ${latest.inboundActive} active, ${latest.inboundJunk} junk`);
  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(n);
  lines.push(`Outbound: ${fmtK(latest.outboundLeads)} leads → ${fmtK(latest.outboundReached)} reached → ${fmtK(latest.outboundFollowed)} followed → ${latest.outboundQualified} qualified`);
  if (latest.apolloContacts > 0) {
    lines.push(`Apollo: ${latest.apolloContacts.toLocaleString()} contacts`);
  }
  lines.push("");

  // Cost
  const costItems: CostItem[] = snap?.costItems ?? [];
  const topCost = costItems.slice().sort((a, b) => b.costUsd - a.costUsd).slice(0, 3);
  lines.push(`💰 Cost: $${latest.totalCostUsd.toLocaleString()}${delta(latest.totalCostUsd, previous?.totalCostUsd ?? 0)}`);
  if (topCost.length > 0) {
    lines.push(`Top: ${topCost.map((it) => `${it.name} $${it.costUsd.toLocaleString()}`).join(" | ")}`);
  }

  // Org movements
  if (previous && prevSnap) {
    const movements = computeOrgMovements(snap, prevSnap);
    const movementLines: string[] = [];
    for (const seg of ALL_V2_SEGMENTS) {
      const { added } = movements[seg];
      if (added.length > 0) {
        const segLabel = seg === "paying" ? "Paying" : seg === "prospect" ? "Prospects" : seg === "trial" ? "Trial" : seg === "post_demo" ? "Post-Demo" : seg === "demo_queued" ? "Demo Queued" : seg === "dormant" ? "Dormant" : seg === "lost" ? "Lost" : "Early";
        movementLines.push(`New in ${segLabel}: ${added.join(", ")}`);
      }
    }
    if (movementLines.length > 0) {
      lines.push("");
      lines.push("🔄 Org Movements");
      lines.push(...movementLines);
    }
  }

  return lines.join("\n");
}

/** Build auto-generated delta summary for agenda */
export function buildDeltaSummary(
  current: GtmEntry,
  previous: GtmEntry | null
): string {
  if (!previous) return "";

  const parts: string[] = [];
  const currSnap = current.orgSnapshot;
  const prevSnap = previous.orgSnapshot;

  const labelMap: Record<string, string> = {
    paying: "Paying",
    prospect: "Prospects",
    trial: "Trials",
    post_demo: "Post-Demo",
    demo_queued: "Demo Queued",
    dormant: "Dormant",
    lost: "Lost",
  };

  for (const [seg, label] of Object.entries(labelMap)) {
    const curr = currSnap?.counts?.[seg as GtmV2Segment] ?? 0;
    const prev = prevSnap?.counts?.[seg as GtmV2Segment] ?? 0;
    const d = curr - prev;
    if (d !== 0) {
      parts.push(`${label} ${d > 0 ? "+" : ""}${d}`);
    }
  }

  if (parts.length === 0) return "No pipeline changes";
  return `Since ${formatEntryDate(previous.entryDate)}: ${parts.join(", ")}`;
}

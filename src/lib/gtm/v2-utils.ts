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
  for (const item of costItems) {
    totalCost += item.costUsd;
    totalUsers += item.users;
  }

  return { counts, names, totalCost, totalUsers, totalConversations: 0, costItems };
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

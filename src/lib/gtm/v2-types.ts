// GTM V2 Types — decoupled from v1 gtm_organizations

export type GtmV2Segment =
  | "paying"
  | "prospect"
  | "trial"
  | "dormant"
  | "lost"
  | "post_demo"
  | "demo_queued"
  | "early";

export const ALL_V2_SEGMENTS: GtmV2Segment[] = [
  "paying",
  "prospect",
  "trial",
  "post_demo",
  "demo_queued",
  "dormant",
  "lost",
  "early",
];

export const SEGMENT_LABELS: Record<GtmV2Segment, string> = {
  paying: "Paying",
  prospect: "Strong Prospect",
  trial: "Active Trial",
  post_demo: "Post-Demo",
  demo_queued: "Demo Queued",
  dormant: "Dormant",
  lost: "Lost",
  early: "Early / No Info",
};

export const SEGMENT_COLORS: Record<GtmV2Segment, string> = {
  paying: "text-emerald-700 bg-emerald-50",
  prospect: "text-blue-700 bg-blue-50",
  trial: "text-purple-700 bg-purple-50",
  post_demo: "text-amber-700 bg-amber-50",
  demo_queued: "text-orange-700 bg-orange-50",
  dormant: "text-gray-500 bg-gray-100",
  lost: "text-red-600 bg-red-50",
  early: "text-gray-400 bg-gray-50",
};

export interface GtmOrg {
  id: string;
  name: string;
  domain: string | null;
  segment: GtmV2Segment;
  accountManager: string | null;
  tags: string[];
  notes: string | null;
  costUsd: number;
  conversations: number;
  users: number;
  createdAt: string;
  updatedAt: string;
}

export interface GtmEntry {
  id: string;
  entryDate: string; // YYYY-MM-DD
  createdBy: string | null;
  // Lead gen
  inboundTotal: number;
  inboundActive: number;
  inboundJunk: number;
  outboundLeads: number;
  outboundReached: number;
  outboundFollowed: number;
  outboundQualified: number;
  apolloContacts: number;
  apolloNote: string | null;
  // Cost
  totalCostUsd: number;
  costPeriod: string | null;
  // AM demos
  amDemos: Record<string, number>;
  // Org snapshot
  orgSnapshot: OrgSnapshot;
  createdAt: string;
}

export interface CostItem {
  name: string;
  costUsd: number;
  users: number;
}

export interface OrgSnapshot {
  counts: Record<GtmV2Segment, number>;
  names: Record<GtmV2Segment, string[]>;
  totalCost: number;
  totalUsers: number;
  totalConversations: number;
  costItems?: CostItem[];
}

export type AgendaSection =
  | "pipeline_updates"
  | "action_items"
  | "escalations"
  | "decisions_needed";

export const AGENDA_SECTIONS: { key: AgendaSection; label: string }[] = [
  { key: "pipeline_updates", label: "Pipeline Updates" },
  { key: "action_items", label: "Action Items" },
  { key: "escalations", label: "Escalations" },
  { key: "decisions_needed", label: "Decisions Needed" },
];

export interface GtmAgendaItem {
  id: string;
  entryDate: string;
  section: AgendaSection;
  content: string;
  sortOrder: number;
  isResolved: boolean;
  createdBy: string | null;
  createdAt: string;
}

// Delta computation types
export interface SegmentDeltaV2 {
  segment: GtmV2Segment;
  current: number;
  previous: number;
  delta: number;
  currentNames: string[];
}

export interface EntryDeltas {
  segments: SegmentDeltaV2[];
  leadGen: {
    inboundTotal: number;
    inboundActive: number;
    outboundLeads: number;
    outboundQualified: number;
    apolloContacts: number;
  };
  totalCost: number;
}

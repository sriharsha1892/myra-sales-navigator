// GTM Dashboard Types

export type Segment =
  | "Paying"
  | "Strong Prospect"
  | "Active Trial"
  | "Post-Demo"
  | "Demo Queued"
  | "Dormant"
  | "Lost"
  | "Early/No Info";

export const ALL_SEGMENTS: Segment[] = [
  "Paying",
  "Strong Prospect",
  "Active Trial",
  "Post-Demo",
  "Demo Queued",
  "Dormant",
  "Lost",
  "Early/No Info",
];

export interface GtmOrganization {
  id: string;
  name: string;
  segment: Segment;
  accountManager: string | null;
  leadSource: string | null;
  costTotal: number;
  conversations: number;
  usersCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GtmContact {
  id: string;
  uniqueId: string | null;
  email: string | null;
  name: string | null;
  organizationId: string;
  accountManager: string | null;
  createdAt: string;
}

export interface GtmSnapshot {
  id: string;
  label: string;
  snapshotData: SnapshotData;
  createdAt: string;
}

export interface SegmentSnapshot {
  count: number;
  cost_total: number;
  users_total: number;
  conversations_total: number;
}

export interface LeadGenSnapshot {
  inbound_total: number;
  inbound_active: number;
  inbound_junk: number;
  outbound_leads: number;
  outbound_reached: number;
  outbound_followed: number;
  outbound_qualified: number;
  apollo_contacts: number;
  apollo_status: string;
}

export interface SnapshotData {
  segments: Record<string, SegmentSnapshot>;
  lead_gen: LeadGenSnapshot;
}

export interface GtmUpdate {
  id: string;
  snapshotId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface GtmLeadGen {
  id: string;
  snapshotId: string | null;
  inboundTotal: number;
  inboundActive: number;
  inboundJunk: number;
  outboundLeads: number;
  outboundReached: number;
  outboundFollowed: number;
  outboundQualified: number;
  apolloContacts: number;
  apolloStatus: string | null;
  createdAt: string;
}

export interface GtmCostEntry {
  id: string;
  organizationId: string;
  amount: number;
  entryType: "incremental" | "absolute";
  enteredBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface RoadmapTile {
  title: string;
  description: string;
}

export interface SegmentDelta {
  current: number;
  previous: number;
  delta: number;
}

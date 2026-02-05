import { z } from "zod";

export const v2SegmentEnum = z.enum([
  "paying", "prospect", "trial", "dormant", "lost",
  "post_demo", "demo_queued", "early",
]);

export const v2OrgSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: "Name is required" }),
  domain: z.string().optional().nullable(),
  segment: v2SegmentEnum,
  accountManager: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  costUsd: z.number().min(0).optional(),
  conversations: z.number().int().min(0).optional(),
  users: z.number().int().min(0).optional(),
});

export const v2OrgUpdateSchema = z.object({
  id: z.string().uuid({ message: "Valid ID required" }),
  name: z.string().min(1).optional(),
  domain: z.string().optional().nullable(),
  segment: v2SegmentEnum.optional(),
  accountManager: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  costUsd: z.number().min(0).optional(),
  conversations: z.number().int().min(0).optional(),
  users: z.number().int().min(0).optional(),
});

export const v2BulkSegmentSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, { message: "At least one ID required" }),
  segment: v2SegmentEnum,
});

const costItemSchema = z.object({
  name: z.string(),
  costUsd: z.number().min(0),
  users: z.number().int().min(0),
  conversations: z.number().int().min(0).optional(),
});

const orgSnapshotSchema = z.object({
  counts: z.record(z.string(), z.number().int().min(0)),
  names: z.record(z.string(), z.array(z.string())),
  totalCost: z.number().min(0),
  totalUsers: z.number().int().min(0),
  totalConversations: z.number().int().min(0),
  costItems: z.array(costItemSchema).optional(),
});

export const v2EntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
  createdBy: z.string().optional().nullable(),
  inboundTotal: z.number().int().min(0).optional(),
  inboundActive: z.number().int().min(0).optional(),
  inboundJunk: z.number().int().min(0).optional(),
  outboundLeads: z.number().int().min(0).optional(),
  outboundReached: z.number().int().min(0).optional(),
  outboundFollowed: z.number().int().min(0).optional(),
  outboundQualified: z.number().int().min(0).optional(),
  apolloContacts: z.number().int().min(0).optional(),
  apolloNote: z.string().optional().nullable(),
  totalCostUsd: z.number().min(0).optional(),
  costPeriod: z.string().optional().nullable(),
  amDemos: z.record(z.string(), z.number().int().min(0)).optional(),
  orgSnapshot: orgSnapshotSchema.optional(),
});

export const v2BulkCreateSchema = z.object({
  orgs: z
    .array(
      z.object({
        name: z.string().min(1, { message: "Name is required" }),
        segment: v2SegmentEnum,
        accountManager: z.string().optional().nullable(),
        domain: z.string().optional().nullable(),
      })
    )
    .min(1, { message: "At least one org required" })
    .max(500, { message: "Maximum 500 orgs per import" }),
});

export const v2AgendaItemSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  section: z.enum(["pipeline_updates", "action_items", "escalations", "decisions_needed"]),
  content: z.string().min(1, { message: "Content is required" }),
  sortOrder: z.number().int().min(0).optional(),
  createdBy: z.string().optional().nullable(),
});

export const v2AgendaUpdateSchema = z.object({
  id: z.string().uuid(),
  isResolved: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  content: z.string().min(1).optional(),
});

// --- AM Performance ---

const amChannelSchema = z.object({
  email: z.number().int().min(0),
  calls: z.number().int().min(0),
  linkedin: z.number().int().min(0),
  waOther: z.number().int().min(0),
});

const amRowSchema = z.object({
  name: z.string().min(1, { message: "AM name is required" }),
  outreach: z.number().int().min(0),
  demos: z.number().int().min(0),
  sales: z.number().int().min(0),
  demoChannels: amChannelSchema.nullable(),
  outreachChannels: amChannelSchema.nullable(),
  note: z.string(),
  status: z.enum(["active", "inactive"]),
});

export const v2AmPerformanceSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD" }),
  amData: z.array(amRowSchema).min(1, { message: "At least one AM required" }),
});

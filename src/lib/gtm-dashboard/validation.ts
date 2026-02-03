import { z } from "zod";

const ALL_SEGMENTS = [
  "Paying",
  "Strong Prospect",
  "Active Trial",
  "Post-Demo",
  "Demo Queued",
  "Dormant",
  "Lost",
  "Early/No Info",
] as const;

export const segmentEnum = z.enum(ALL_SEGMENTS);

export const organizationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, { message: "Name is required" }),
  segment: segmentEnum,
  accountManager: z.string().optional().nullable(),
  leadSource: z.string().optional().nullable(),
  costTotal: z.number().min(0).optional(),
  conversations: z.number().int().min(0).optional(),
  usersCount: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export const bulkOrgsSchema = z.object({
  organizations: z
    .array(organizationSchema)
    .min(1, { message: "At least one organization required" })
    .max(500, { message: "Maximum 500 organizations per bulk import" }),
});

export const costEntrySchema = z.object({
  organizationId: z.string().uuid({ message: "Valid organization ID required" }),
  amount: z.number().finite({ message: "Amount must be a finite number" }),
  entryType: z.enum(["incremental", "absolute"]),
  enteredBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const leadGenSchema = z.object({
  id: z.string().uuid().optional(),
  snapshotId: z.string().uuid().optional().nullable(),
  inboundTotal: z.number().int().min(0).optional(),
  inboundActive: z.number().int().min(0).optional(),
  inboundJunk: z.number().int().min(0).optional(),
  outboundLeads: z.number().int().min(0).optional(),
  outboundReached: z.number().int().min(0).optional(),
  outboundFollowed: z.number().int().min(0).optional(),
  outboundQualified: z.number().int().min(0).optional(),
  apolloContacts: z.number().int().min(0).optional(),
  apolloStatus: z.string().optional().nullable(),
});

export const snapshotSchema = z.object({
  label: z.string().min(1, { message: "Label is required" }),
  snapshotData: z.record(z.string(), z.unknown()),
});

export const updateSchema = z.object({
  content: z.string().min(1, { message: "Content is required" }),
  snapshotId: z.string().uuid().optional().nullable(),
});

export const updateEditSchema = z.object({
  id: z.string().uuid({ message: "Valid update ID required" }),
  content: z.string().min(1, { message: "Content is required" }),
});

export const configSchema = z.object({
  key: z.string().min(1, { message: "Key is required" }),
  value: z.unknown(),
});

export const pinSchema = z.object({
  pin: z
    .string()
    .length(12, { message: "PIN must be exactly 12 digits" })
    .regex(/^\d{12}$/, { message: "PIN must contain only digits" }),
});

export const deleteOrgSchema = z.object({
  id: z.string().uuid({ message: "Valid ID required" }),
});

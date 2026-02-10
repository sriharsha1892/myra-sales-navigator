import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod validation for admin config writes (PUT /api/admin/config)
// Prevents malformed ICP weights, broken pipeline stages, or invalid cache
// durations from being saved to Supabase.
//
// Each field is optional — the PUT handler only writes fields that are present
// in the request body. We validate whatever is sent.
// ---------------------------------------------------------------------------

const icpWeightsSchema = z.object({
  verticalMatch: z.number({ message: "verticalMatch must be a number" }).min(-100, { message: "verticalMatch must be >= -100" }).max(100, { message: "verticalMatch must be <= 100" }),
  sizeMatch: z.number({ message: "sizeMatch must be a number" }).min(-100, { message: "sizeMatch must be >= -100" }).max(100, { message: "sizeMatch must be <= 100" }),
  regionMatch: z.number({ message: "regionMatch must be a number" }).min(-100, { message: "regionMatch must be >= -100" }).max(100, { message: "regionMatch must be <= 100" }),
  buyingSignals: z.number({ message: "buyingSignals must be a number" }).min(-100, { message: "buyingSignals must be >= -100" }).max(100, { message: "buyingSignals must be <= 100" }),
  negativeSignals: z.number({ message: "negativeSignals must be a number" }).min(-100, { message: "negativeSignals must be >= -100" }).max(100, { message: "negativeSignals must be <= 100" }),
  exaRelevance: z.number({ message: "exaRelevance must be a number" }).min(-100, { message: "exaRelevance must be >= -100" }).max(100, { message: "exaRelevance must be <= 100" }),
  hubspotLead: z.number({ message: "hubspotLead must be a number" }).min(-100, { message: "hubspotLead must be >= -100" }).max(100, { message: "hubspotLead must be <= 100" }),
  hubspotCustomer: z.number({ message: "hubspotCustomer must be a number" }).min(-100, { message: "hubspotCustomer must be >= -100" }).max(100, { message: "hubspotCustomer must be <= 100" }),
  freshsalesLead: z.number({ message: "freshsalesLead must be a number" }).min(-100, { message: "freshsalesLead must be >= -100" }).max(100, { message: "freshsalesLead must be <= 100" }),
  freshsalesCustomer: z.number({ message: "freshsalesCustomer must be a number" }).min(-100, { message: "freshsalesCustomer must be >= -100" }).max(100, { message: "freshsalesCustomer must be <= 100" }),
  freshsalesRecentContact: z.number({ message: "freshsalesRecentContact must be a number" }).min(-100, { message: "freshsalesRecentContact must be >= -100" }).max(100, { message: "freshsalesRecentContact must be <= 100" }),
  freshsalesTagBoost: z.number({ message: "freshsalesTagBoost must be a number" }).min(-100, { message: "freshsalesTagBoost must be >= -100" }).max(100, { message: "freshsalesTagBoost must be <= 100" }),
  freshsalesTagPenalty: z.number({ message: "freshsalesTagPenalty must be a number" }).min(-100, { message: "freshsalesTagPenalty must be >= -100" }).max(100, { message: "freshsalesTagPenalty must be <= 100" }),
  freshsalesDealStalled: z.number({ message: "freshsalesDealStalled must be a number" }).min(-100, { message: "freshsalesDealStalled must be >= -100" }).max(100, { message: "freshsalesDealStalled must be <= 100" }),
});

const cacheDurationsSchema = z.object({
  exa: z.number({ message: "exa cache duration must be a number" }).int({ message: "exa cache duration must be an integer" }).min(1, { message: "exa cache duration must be positive" }),
  apollo: z.number({ message: "apollo cache duration must be a number" }).int({ message: "apollo cache duration must be an integer" }).min(1, { message: "apollo cache duration must be positive" }),
  hubspot: z.number({ message: "hubspot cache duration must be a number" }).int({ message: "hubspot cache duration must be an integer" }).min(1, { message: "hubspot cache duration must be positive" }),
  clearout: z.number({ message: "clearout cache duration must be a number" }).int({ message: "clearout cache duration must be an integer" }).min(1, { message: "clearout cache duration must be positive" }),
  freshsales: z.number({ message: "freshsales cache duration must be a number" }).int({ message: "freshsales cache duration must be an integer" }).min(1, { message: "freshsales cache duration must be positive" }),
});

const sizeSweetSpotSchema = z
  .object({
    min: z.number({ message: "sizeSweetSpot.min must be a number" }).int({ message: "sizeSweetSpot.min must be an integer" }).min(0, { message: "sizeSweetSpot.min must be >= 0" }),
    max: z.number({ message: "sizeSweetSpot.max must be a number" }).int({ message: "sizeSweetSpot.max must be an integer" }).min(1, { message: "sizeSweetSpot.max must be >= 1" }),
  })
  .refine((v) => v.min < v.max, { message: "sizeSweetSpot.min must be less than sizeSweetSpot.max" });

const signalTypeEntrySchema = z.object({
  type: z.string({ message: "signal type must be a string" }).min(1, { message: "signal type must not be empty" }),
  enabled: z.boolean({ message: "signal enabled must be a boolean" }),
});

const teamMemberSchema = z.object({
  name: z.string({ message: "team member name must be a string" }).min(1, { message: "team member name must not be empty" }),
  email: z.string({ message: "team member email must be a string" }).email({ message: "team member email must be a valid email" }),
  isAdmin: z.boolean({ message: "team member isAdmin must be a boolean" }),
  lastLoginAt: z.string().optional(),
  lastMentionReadAt: z.string().optional(),
});

const copyFormatSchema = z.object({
  id: z.string({ message: "copy format id must be a string" }).min(1, { message: "copy format id must not be empty" }),
  name: z.string({ message: "copy format name must be a string" }).min(1, { message: "copy format name must not be empty" }),
  template: z.string({ message: "copy format template must be a string" }),
});

const enrichmentLimitsSchema = z.object({
  maxSearchEnrich: z.number({ message: "maxSearchEnrich must be a number" }).int({ message: "maxSearchEnrich must be an integer" }).min(0, { message: "maxSearchEnrich must be >= 0" }),
  maxContactAutoEnrich: z.number({ message: "maxContactAutoEnrich must be a number" }).int({ message: "maxContactAutoEnrich must be an integer" }).min(0, { message: "maxContactAutoEnrich must be >= 0" }),
  maxClearoutFinds: z.number({ message: "maxClearoutFinds must be a number" }).int({ message: "maxClearoutFinds must be an integer" }).min(0, { message: "maxClearoutFinds must be >= 0" }),
});

const icpProfileSchema = z.object({
  id: z.string().min(1, { message: "ICP profile id must not be empty" }),
  name: z.string().min(1, { message: "ICP profile name must not be empty" }),
  verticals: z.array(z.string(), { message: "ICP profile verticals must be an array of strings" }),
  sizeMin: z.number({ message: "ICP profile sizeMin must be a number" }).int().min(0),
  sizeMax: z.number({ message: "ICP profile sizeMax must be a number" }).int().min(1),
  regions: z.array(z.string(), { message: "ICP profile regions must be an array of strings" }),
  signalTypes: z.array(z.string(), { message: "ICP profile signalTypes must be an array of strings" }),
  isDefault: z.boolean({ message: "ICP profile isDefault must be a boolean" }),
});

const toggleRuleSchema = z.object({
  id: z.string().min(1, { message: "rule id must not be empty" }),
  name: z.string().min(1, { message: "rule name must not be empty" }),
  enabled: z.boolean({ message: "rule enabled must be a boolean" }),
});

const outreachChannelSchema = z.enum(["email", "linkedin_connect", "linkedin_inmail", "whatsapp", "call"]);

const outreachChannelConfigSchema = z.object({
  enabledChannels: z.array(outreachChannelSchema, { message: "enabledChannels must be an array of valid outreach channels" }),
  defaultChannel: outreachChannelSchema,
  channelInstructions: z.record(z.string(), z.string()).optional(),
  writingRulesDefault: z.string({ message: "writingRulesDefault must be a string" }),
});

// ---------------------------------------------------------------------------
// Top-level schema — every field optional since PUT is partial update
// ---------------------------------------------------------------------------

export const adminConfigUpdateSchema = z.object({
  icpWeights: icpWeightsSchema.optional(),
  verticals: z.array(z.string({ message: "each vertical must be a string" }), { message: "verticals must be an array of strings" }).optional(),
  sizeSweetSpot: sizeSweetSpotSchema.optional(),
  signalTypes: z.array(signalTypeEntrySchema).optional(),
  teamMembers: z.array(teamMemberSchema).optional(),
  cacheDurations: cacheDurationsSchema.optional(),
  copyFormats: z.array(copyFormatSchema).optional(),
  defaultCopyFormat: z.string({ message: "defaultCopyFormat must be a string" }).optional(),
  apiKeys: z.array(z.record(z.string(), z.unknown())).optional(),
  dataSources: z.array(z.record(z.string(), z.unknown())).optional(),
  exportSettings: z.record(z.string(), z.unknown()).optional(),
  emailVerification: z.record(z.string(), z.unknown()).optional(),
  scoringSettings: z.record(z.string(), z.unknown()).optional(),
  rateLimits: z.record(z.string(), z.unknown()).optional(),
  notifications: z.record(z.string(), z.unknown()).optional(),
  dataRetention: z.record(z.string(), z.unknown()).optional(),
  authSettings: z.record(z.string(), z.unknown()).optional(),
  uiPreferences: z.record(z.string(), z.unknown()).optional(),
  emailPrompts: z.record(z.string(), z.unknown()).optional(),
  analyticsSettings: z.record(z.string(), z.unknown()).optional(),
  enrichmentLimits: enrichmentLimitsSchema.optional(),
  icpProfiles: z.array(icpProfileSchema).optional(),
  freshsalesSettings: z.record(z.string(), z.unknown()).optional(),
  authLog: z.array(z.record(z.string(), z.unknown())).optional(),
  authRequests: z.array(z.record(z.string(), z.unknown())).optional(),
  outreachChannelConfig: outreachChannelConfigSchema.optional(),
  outreachSuggestionRules: z.array(toggleRuleSchema).optional(),
  actionRecommendationRules: z.array(toggleRuleSchema).optional(),
  actionRecommendationEnabled: z.boolean({ message: "actionRecommendationEnabled must be a boolean" }).optional(),
  discoveryEngine: z.enum(["exa", "parallel", "round_robin"], { message: "discoveryEngine must be one of: exa, parallel, round_robin" }).optional(),
});

// ---------------------------------------------------------------------------
// Helper to format Zod errors into a flat list of human-readable messages
// ---------------------------------------------------------------------------

export function formatValidationErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Org data (Feb 3 state — latest) ──

interface OrgSeed {
  name: string;
  segment: string;
  cost: number;
  conversations: number;
  users: number;
}

const PAYING: OrgSeed[] = [
  { name: "Wipak", segment: "paying", cost: 3797, conversations: 765, users: 2 },
  { name: "Synarchy", segment: "paying", cost: 2032, conversations: 613, users: 2 },
  { name: "Andeco", segment: "paying", cost: 1762, conversations: 1572, users: 4 },
  { name: "Kemin", segment: "paying", cost: 1209, conversations: 762, users: 5 },
  { name: "Cereal Docks", segment: "paying", cost: 1206, conversations: 534, users: 2 },
  { name: "Mitsubishi Chemical Group", segment: "paying", cost: 437, conversations: 196, users: 2 },
  { name: "Israel Export Institute", segment: "paying", cost: 239, conversations: 196, users: 2 },
  { name: "Unit Consulting", segment: "paying", cost: 54, conversations: 26, users: 2 },
];

const PROSPECT: OrgSeed[] = [
  { name: "Wacker", segment: "prospect", cost: 493.92, conversations: 218, users: 3 },
  { name: "Ergomed Group", segment: "prospect", cost: 444, conversations: 285, users: 2 },
  { name: "Dubai Investments", segment: "prospect", cost: 430, conversations: 272, users: 2 },
  { name: "Rich", segment: "prospect", cost: 298, conversations: 109, users: 3 },
  { name: "Schneider Electric", segment: "prospect", cost: 223, conversations: 88, users: 2 },
  { name: "TotalEnergies", segment: "prospect", cost: 176, conversations: 148, users: 3 },
  { name: "ExxonMobil", segment: "prospect", cost: 155, conversations: 89, users: 5 },
  { name: "Toronto Transit Commission", segment: "prospect", cost: 153, conversations: 122, users: 2 },
  { name: "Actio Consultancy", segment: "prospect", cost: 84, conversations: 73, users: 3 },
  { name: "Solution for Development", segment: "prospect", cost: 68, conversations: 44, users: 2 },
  { name: "Foremost Farms", segment: "prospect", cost: 66, conversations: 25, users: 1 },
  { name: "DAL Group (Alliance)", segment: "prospect", cost: 58, conversations: 18, users: 2 },
  { name: "Horwath HTL", segment: "prospect", cost: 58, conversations: 38, users: 2 },
  { name: "Amazon", segment: "prospect", cost: 43.03, conversations: 30, users: 3 },
  { name: "TD Synnex", segment: "prospect", cost: 30, conversations: 30, users: 2 },
  { name: "Aleris Animal Nutrition", segment: "prospect", cost: 28, conversations: 23, users: 1 },
  { name: "CCAD", segment: "prospect", cost: 16, conversations: 24, users: 1 },
];

const TRIAL: OrgSeed[] = [
  { name: "Touche Consulting", segment: "trial", cost: 377, conversations: 253, users: 2 },
  { name: "TCS", segment: "trial", cost: 356, conversations: 307, users: 5 },
  { name: "TDK", segment: "trial", cost: 257, conversations: 200, users: 3 },
  { name: "Samsung", segment: "trial", cost: 206, conversations: 178, users: 5 },
  { name: "Finagra", segment: "trial", cost: 201, conversations: 232, users: 2 },
  { name: "Aramex", segment: "trial", cost: 182, conversations: 129, users: 1 },
  { name: "Vardaan Global", segment: "trial", cost: 136, conversations: 93, users: 3 },
  { name: "Reliance", segment: "trial", cost: 74, conversations: 57, users: 5 },
  { name: "Mitsui & Co.", segment: "trial", cost: 70, conversations: 57, users: 3 },
  { name: "Littler Associates", segment: "trial", cost: 67, conversations: 44, users: 3 },
  { name: "Sherwin-Williams", segment: "trial", cost: 47.09, conversations: 46, users: 1 },
  { name: "Sojitz", segment: "trial", cost: 42, conversations: 40, users: 2 },
  { name: "Advantest", segment: "trial", cost: 38, conversations: 23, users: 1 },
  { name: "O-I", segment: "trial", cost: 33.1, conversations: 22, users: 1 },
  { name: "Pure Insights", segment: "trial", cost: 32, conversations: 31, users: 1 },
  { name: "Linc Consulting", segment: "trial", cost: 27, conversations: 26, users: 1 },
  { name: "Piramal Consumer Products", segment: "trial", cost: 22, conversations: 22, users: 3 },
];

const ALL_ORGS = [...PAYING, ...PROSPECT, ...TRIAL];

// ── Jan 30 cost data (differs from Feb 3 for some orgs) ──

const JAN30_COSTS: Record<string, { cost: number; conversations: number; users: number }> = {
  // Paying
  Wipak: { cost: 3781, conversations: 753, users: 2 },
  Synarchy: { cost: 1890, conversations: 545, users: 2 },
  Andeco: { cost: 1652, conversations: 1476, users: 4 },
  Kemin: { cost: 1207, conversations: 760, users: 5 },
  "Cereal Docks": { cost: 1173, conversations: 520, users: 2 },
  "Mitsubishi Chemical Group": { cost: 423, conversations: 180, users: 2 },
  "Israel Export Institute": { cost: 239, conversations: 196, users: 2 },
  "Unit Consulting": { cost: 54, conversations: 26, users: 2 },
  // Prospect
  Wacker: { cost: 493.92, conversations: 218, users: 3 },
  "Ergomed Group": { cost: 444, conversations: 285, users: 2 },
  "Dubai Investments": { cost: 430, conversations: 272, users: 2 },
  Rich: { cost: 298, conversations: 109, users: 3 },
  "Schneider Electric": { cost: 223, conversations: 88, users: 2 },
  TotalEnergies: { cost: 167, conversations: 136, users: 3 },
  ExxonMobil: { cost: 155, conversations: 89, users: 5 },
  "Toronto Transit Commission": { cost: 133, conversations: 103, users: 2 },
  "Actio Consultancy": { cost: 84, conversations: 73, users: 3 },
  "Solution for Development": { cost: 68, conversations: 44, users: 2 },
  "Foremost Farms": { cost: 66, conversations: 25, users: 1 },
  "DAL Group (Alliance)": { cost: 58, conversations: 18, users: 2 },
  "Horwath HTL": { cost: 58, conversations: 38, users: 2 },
  Amazon: { cost: 43.03, conversations: 30, users: 3 },
  "TD Synnex": { cost: 30, conversations: 30, users: 2 },
  "Aleris Animal Nutrition": { cost: 28, conversations: 23, users: 1 },
  CCAD: { cost: 16, conversations: 24, users: 1 },
  // Trial (13 active_trial orgs tracked on Jan 30)
  TCS: { cost: 356, conversations: 307, users: 5 },
  "Touche Consulting": { cost: 345, conversations: 232, users: 2 },
  TDK: { cost: 237, conversations: 185, users: 3 },
  Samsung: { cost: 206, conversations: 178, users: 5 },
  Aramex: { cost: 182, conversations: 129, users: 1 },
  "Vardaan Global": { cost: 136, conversations: 93, users: 3 },
  "Mitsui & Co.": { cost: 70, conversations: 57, users: 3 },
  "Littler Associates": { cost: 67, conversations: 44, users: 3 },
  Sojitz: { cost: 42, conversations: 40, users: 2 },
  Advantest: { cost: 38, conversations: 23, users: 1 },
  "O-I": { cost: 33.10, conversations: 22, users: 1 },
  "Sherwin-Williams": { cost: 22, conversations: 25, users: 1 },
  "Piramal Consumer Products": { cost: 22, conversations: 22, users: 3 },
};

// ── Step 1: Upsert orgs (Feb 3 state) ──

async function upsertOrgs() {
  console.log("=== Step 1: Upserting 42 orgs into gtm_orgs ===\n");
  let created = 0, updated = 0, errors = 0;

  for (const org of ALL_ORGS) {
    const { data: existing } = await sb
      .from("gtm_orgs")
      .select("id")
      .eq("name", org.name)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .from("gtm_orgs")
        .update({
          segment: org.segment,
          cost_usd: org.cost,
          conversations: org.conversations,
          users: org.users,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) { console.error(`Update error "${org.name}":`, error.message); errors++; }
      else updated++;
    } else {
      const { error } = await sb.from("gtm_orgs").insert({
        name: org.name,
        segment: org.segment,
        cost_usd: org.cost,
        conversations: org.conversations,
        users: org.users,
      });
      if (error) { console.error(`Insert error "${org.name}":`, error.message); errors++; }
      else created++;
    }
  }

  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${ALL_ORGS.length}\n`);
}

// ── Step 2: Create 3 gtm_entries ──

function buildCostItems(
  orgNames: string[],
  costSource: Record<string, { cost: number; conversations: number; users: number }>
) {
  return orgNames.map((name) => {
    const d = costSource[name];
    return { name, costUsd: d?.cost ?? 0, users: d?.users ?? 0 };
  });
}

function sumField(
  items: { cost: number; conversations: number; users: number }[],
  field: "cost" | "conversations" | "users"
) {
  return items.reduce((s, i) => s + i[field], 0);
}

async function createEntries() {
  console.log("=== Step 2: Creating 3 gtm_entries ===\n");

  const payingNames = PAYING.map((o) => o.name);
  const prospectNames = PROSPECT.map((o) => o.name);

  // Jan 30 trial names (13 active_trial orgs)
  const jan30TrialNames = [
    "TCS", "Touche Consulting", "TDK", "Samsung", "Aramex",
    "Vardaan Global", "Mitsui & Co.", "Littler Associates", "Sojitz",
    "Advantest", "O-I", "Sherwin-Williams", "Piramal Consumer Products",
  ];

  // Feb 3 trial names (17 active_trial orgs)
  const feb3TrialNames = TRIAL.map((o) => o.name);

  // ── Entry 1: 2026-01-23 (Baseline) ──
  const entry1 = {
    entry_date: "2026-01-23",
    created_by: "seed-script",
    inbound_total: 23,
    inbound_active: 0,
    inbound_junk: 0,
    outbound_leads: 0,
    outbound_reached: 0,
    outbound_followed: 0,
    outbound_qualified: 0,
    apollo_contacts: 0,
    apollo_note: null,
    total_cost_usd: 0,
    cost_period: null,
    am_demos: {},
    org_snapshot: {
      counts: {
        paying: 8,
        prospect: 14,
        trial: 22, // active_trial (18) + recently_rolled_out (4)
        post_demo: 18,
        demo_queued: 17,
        dormant: 30,
        lost: 20,
        early: 5,
      },
      names: {
        paying: [],
        prospect: [],
        trial: [],
        post_demo: [],
        demo_queued: [],
        dormant: [],
        lost: [],
        early: [],
      },
      totalCost: 0,
      totalUsers: 0,
      totalConversations: 0,
    },
  };

  // ── Entry 2: 2026-01-30 ──
  const jan30PayingCosts = payingNames.map((n) => JAN30_COSTS[n]);
  const jan30ProspectCosts = prospectNames.map((n) => JAN30_COSTS[n]);
  const jan30TrialCosts = jan30TrialNames.map((n) => JAN30_COSTS[n]);
  const allJan30Costs = [...jan30PayingCosts, ...jan30ProspectCosts, ...jan30TrialCosts];

  const entry2 = {
    entry_date: "2026-01-30",
    created_by: "seed-script",
    inbound_total: 30,
    inbound_active: 6,
    inbound_junk: 22,
    outbound_leads: 10000,
    outbound_reached: 8100,
    outbound_followed: 5200,
    outbound_qualified: 4,
    apollo_contacts: 1400,
    apollo_note: "no_progress",
    total_cost_usd: 14971.05,
    cost_period: "2025-10-01 to 2026-01-29",
    am_demos: {},
    org_snapshot: {
      counts: {
        paying: 8,
        prospect: 19,
        trial: 27, // active_trial (18) + recently_rolled_out (9)
        post_demo: 18,
        demo_queued: 17,
        dormant: 30,
        lost: 20,
        early: 5,
      },
      names: {
        paying: payingNames,
        prospect: prospectNames,
        trial: jan30TrialNames,
        post_demo: [],
        demo_queued: [],
        dormant: [],
        lost: [],
        early: [],
      },
      totalCost: 14971.05,
      totalUsers: sumField(allJan30Costs, "users"),
      totalConversations: sumField(allJan30Costs, "conversations"),
      costItems: [
        ...buildCostItems(payingNames, JAN30_COSTS),
        ...buildCostItems(prospectNames, JAN30_COSTS),
        ...buildCostItems(jan30TrialNames, JAN30_COSTS),
      ],
    },
  };

  // ── Entry 3: 2026-02-03 ──
  const feb3CostSource: Record<string, { cost: number; conversations: number; users: number }> = {};
  for (const org of ALL_ORGS) {
    feb3CostSource[org.name] = { cost: org.cost, conversations: org.conversations, users: org.users };
  }
  const allFeb3Costs = ALL_ORGS.map((o) => ({ cost: o.cost, conversations: o.conversations, users: o.users }));

  const entry3 = {
    entry_date: "2026-02-03",
    created_by: "seed-script",
    inbound_total: 35,
    inbound_active: 5,
    inbound_junk: 26,
    outbound_leads: 10000,
    outbound_reached: 8100,
    outbound_followed: 5200,
    outbound_qualified: 4,
    apollo_contacts: 1400,
    apollo_note: "no_progress",
    total_cost_usd: 15728.14,
    cost_period: "2025-10-01 to 2026-02-03",
    am_demos: {},
    org_snapshot: {
      counts: {
        paying: 8,
        prospect: 18,
        trial: 31, // active_trial (20) + recently_rolled_out (11)
        post_demo: 20,
        demo_queued: 15,
        dormant: 30,
        lost: 20,
        early: 3,
      },
      names: {
        paying: payingNames,
        prospect: prospectNames,
        trial: feb3TrialNames,
        post_demo: [],
        demo_queued: [],
        dormant: [],
        lost: [],
        early: [],
      },
      totalCost: 15728.14,
      totalUsers: sumField(allFeb3Costs, "users"),
      totalConversations: sumField(allFeb3Costs, "conversations"),
      costItems: [
        ...buildCostItems(payingNames, feb3CostSource),
        ...buildCostItems(prospectNames, feb3CostSource),
        ...buildCostItems(feb3TrialNames, feb3CostSource),
      ],
    },
  };

  for (const entry of [entry1, entry2, entry3]) {
    const { data, error } = await sb
      .from("gtm_entries")
      .upsert(entry, { onConflict: "entry_date" })
      .select("id, entry_date, total_cost_usd")
      .single();

    if (error) {
      console.error(`Error upserting ${entry.entry_date}:`, error.message);
    } else {
      console.log(`  ✓ ${data.entry_date} — $${data.total_cost_usd}`);
    }
  }

  console.log();
}

// ── Verification ──

async function verify() {
  console.log("=== Verification ===\n");

  const { count } = await sb
    .from("gtm_orgs")
    .select("*", { count: "exact", head: true });
  console.log(`  gtm_orgs count: ${count}`);

  const { data: entries } = await sb
    .from("gtm_entries")
    .select("entry_date, total_cost_usd, org_snapshot")
    .order("entry_date");

  if (entries) {
    console.log(`  gtm_entries count: ${entries.length}`);
    for (const e of entries) {
      const snap = e.org_snapshot as { counts?: Record<string, number> };
      console.log(`    ${e.entry_date} — $${e.total_cost_usd} — counts: ${JSON.stringify(snap?.counts)}`);
    }
  }
}

async function main() {
  console.log("Seeding GTM V2 Historical Data\n");
  await upsertOrgs();
  await createEntries();
  await verify();
  console.log("Done!");
}

main().catch(console.error);

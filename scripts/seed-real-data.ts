import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Feb 3 current data (what orgs look like NOW) ──

const paying = [
  { name: "Andeco", cost: 1762, conversations: 1572, users: 4 },
  { name: "Celeral Docks", cost: 1206, conversations: 534, users: 2 },
  { name: "Israel Export Institute", cost: 239, conversations: 196, users: 2 },
  { name: "Kemin", cost: 1209, conversations: 762, users: 5 },
  { name: "Mitsubishi Chemical Group Corporation", cost: 437, conversations: 196, users: 2 },
  { name: "Synarchy", cost: 2032, conversations: 613, users: 2 },
  { name: "Unit Consulting", cost: 54, conversations: 26, users: 2 },
  { name: "Wipak", cost: 3797, conversations: 765, users: 2 },
];

const strongProspect = [
  { name: "Actio Consultancy", cost: 84, conversations: 73, users: 3 },
  { name: "Aleris Animal Nutrition", cost: 28, conversations: 23, users: 1 },
  { name: "DAL Group (Alliance)", cost: 58, conversations: 18, users: 2 },
  { name: "Amazon", cost: 43.03, conversations: 30, users: 3 },
  { name: "CCAD", cost: 16, conversations: 24, users: 1 },
  { name: "Dubai Investments", cost: 430, conversations: 272, users: 2 },
  { name: "Ergomed Group", cost: 444, conversations: 285, users: 2 },
  { name: "ExxonMobil", cost: 155, conversations: 89, users: 5 },
  { name: "Foremost Farms", cost: 66, conversations: 25, users: 1 },
  { name: "Horwathhtl.com", cost: 58, conversations: 38, users: 2 },
  { name: "Rich", cost: 298, conversations: 109, users: 3 },
  { name: "Schneider Electric", cost: 223, conversations: 88, users: 2 },
  { name: "Solution for development consulting", cost: 68, conversations: 44, users: 2 },
  { name: "TD Synnex", cost: 30, conversations: 30, users: 2 },
  { name: "Toronto Transit Commission", cost: 153, conversations: 122, users: 2 },
  { name: "TotalEnergies Marketing & Services", cost: 176, conversations: 148, users: 3 },
  { name: "Wacker", cost: 493.92, conversations: 218, users: 3 },
];

const activeTrial = [
  { name: "Advantest", cost: 38, conversations: 23, users: 1 },
  { name: "Aramex", cost: 182, conversations: 129, users: 1 },
  { name: "Littler Associates", cost: 67, conversations: 44, users: 3 },
  { name: "Mitsui n Co.", cost: 70, conversations: 57, users: 3 },
  { name: "O-I", cost: 33.1, conversations: 22, users: 1 },
  { name: "Piramal Consumer Products", cost: 22, conversations: 22, users: 3 },
  { name: "Samsung", cost: 206, conversations: 178, users: 5 },
  { name: "Sherwin-Williams", cost: 47.09, conversations: 46, users: 1 },
  { name: "Sojitz", cost: 42, conversations: 40, users: 2 },
  { name: "TCS", cost: 356, conversations: 307, users: 5 },
  { name: "TDK", cost: 257, conversations: 200, users: 3 },
  { name: "Touche Consulting", cost: 377, conversations: 253, users: 2 },
  { name: "Vardaan Global", cost: 136, conversations: 93, users: 3 },
  { name: "Finagra", cost: 201, conversations: 232, users: 2 },
  { name: "Reliance", cost: 74, conversations: 57, users: 5 },
  { name: "Linc Consulting", cost: 27, conversations: 26, users: 1 },
  { name: "Pure Insights", cost: 32, conversations: 31, users: 1 },
];

// ── Jan 30 snapshot data (for comparison) ──

const jan30Snapshot = {
  segments: {
    "Paying": {
      count: 8,
      cost_total: 1652 + 1173 + 239 + 1207 + 423 + 1890 + 54 + 3781,
      conversations_total: 1476 + 520 + 196 + 760 + 180 + 545 + 26 + 753,
      users_total: 4 + 2 + 2 + 5 + 2 + 2 + 2 + 2,
    },
    "Strong Prospect": {
      count: 17,
      cost_total: 84 + 28 + 58 + 43.03 + 16 + 430 + 444 + 155 + 66 + 58 + 298 + 223 + 68 + 30 + 133 + 167 + 493.92,
      conversations_total: 73 + 23 + 18 + 30 + 24 + 272 + 285 + 89 + 25 + 38 + 109 + 88 + 44 + 30 + 103 + 136 + 218,
      users_total: 3 + 1 + 2 + 3 + 1 + 2 + 2 + 5 + 1 + 2 + 3 + 2 + 2 + 2 + 2 + 3 + 3,
    },
    "Active Trial": {
      count: 13,
      cost_total: 38 + 182 + 67 + 70 + 33.1 + 22 + 206 + 22 + 42 + 356 + 237 + 345 + 136,
      conversations_total: 23 + 129 + 44 + 57 + 22 + 22 + 178 + 25 + 40 + 307 + 185 + 232 + 93,
      users_total: 1 + 1 + 3 + 3 + 1 + 3 + 5 + 1 + 2 + 5 + 3 + 2 + 3,
    },
  },
};

async function main() {
  console.log("Clearing seed data...");

  // Delete all existing orgs, snapshots, updates, lead_gen, cost_entries
  await sb.from("gtm_cost_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("gtm_updates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("gtm_lead_gen").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("gtm_contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("gtm_organizations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("gtm_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Inserting real organizations (Feb 3 data)...");

  const allOrgs = [
    ...paying.map((o) => ({ ...o, segment: "Paying" })),
    ...strongProspect.map((o) => ({ ...o, segment: "Strong Prospect" })),
    ...activeTrial.map((o) => ({ ...o, segment: "Active Trial" })),
  ];

  const rows = allOrgs.map((o) => ({
    name: o.name,
    segment: o.segment,
    cost_total: o.cost,
    conversations: o.conversations,
    users_count: o.users,
  }));

  const { data: inserted, error: orgErr } = await sb
    .from("gtm_organizations")
    .insert(rows)
    .select();

  if (orgErr) {
    console.error("Failed to insert orgs:", orgErr);
    process.exit(1);
  }
  console.log(`Inserted ${inserted.length} organizations`);

  console.log("Creating Jan 30 snapshot for comparison...");
  const { error: snapErr } = await sb.from("gtm_snapshots").insert({
    label: "Week of 30 Jan 2026",
    snapshot_data: jan30Snapshot,
    created_at: "2026-01-30T10:00:00Z",
  });

  if (snapErr) {
    console.error("Failed to create snapshot:", snapErr);
    process.exit(1);
  }
  console.log("Jan 30 snapshot created");

  console.log("\nDone! Dashboard should now show:");
  console.log(`  Paying: 8 orgs, $${paying.reduce((s, o) => s + o.cost, 0).toFixed(2)} total`);
  console.log(`  Strong Prospect: ${strongProspect.length} orgs, $${strongProspect.reduce((s, o) => s + o.cost, 0).toFixed(2)} total`);
  console.log(`  Active Trial: ${activeTrial.length} orgs, $${activeTrial.reduce((s, o) => s + o.cost, 0).toFixed(2)} total`);
  console.log("\nComparison against Jan 30 snapshot is ready.");
}

main().catch(console.error);

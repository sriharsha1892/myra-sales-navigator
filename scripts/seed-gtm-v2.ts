import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Paste your 4-column TSV data below ──
// Format: AM\tEmail\tSegment\tOrg Name
const DATA = `
`.trim();

// ── Cross-reference data from seed-real-data.ts (38 orgs) ──
const EXISTING_ORG_DATA: Record<
  string,
  { cost: number; conversations: number; users: number }
> = {
  Andeco: { cost: 1762, conversations: 1572, users: 4 },
  "Celeral Docks": { cost: 1206, conversations: 534, users: 2 },
  "Israel Export Institute": { cost: 239, conversations: 196, users: 2 },
  Kemin: { cost: 1209, conversations: 762, users: 5 },
  "Mitsubishi Chemical Group Corporation": { cost: 437, conversations: 196, users: 2 },
  Synarchy: { cost: 2032, conversations: 613, users: 2 },
  "Unit Consulting": { cost: 54, conversations: 26, users: 2 },
  Wipak: { cost: 3797, conversations: 765, users: 2 },
  "Actio Consultancy": { cost: 84, conversations: 73, users: 3 },
  "Aleris Animal Nutrition": { cost: 28, conversations: 23, users: 1 },
  "DAL Group (Alliance)": { cost: 58, conversations: 18, users: 2 },
  Amazon: { cost: 43.03, conversations: 30, users: 3 },
  CCAD: { cost: 16, conversations: 24, users: 1 },
  "Dubai Investments": { cost: 430, conversations: 272, users: 2 },
  "Ergomed Group": { cost: 444, conversations: 285, users: 2 },
  ExxonMobil: { cost: 155, conversations: 89, users: 5 },
  "Foremost Farms": { cost: 66, conversations: 25, users: 1 },
  "Horwathhtl.com": { cost: 58, conversations: 38, users: 2 },
  Rich: { cost: 298, conversations: 109, users: 3 },
  "Schneider Electric": { cost: 223, conversations: 88, users: 2 },
  "Solution for development consulting": { cost: 68, conversations: 44, users: 2 },
  "TD Synnex": { cost: 30, conversations: 30, users: 2 },
  "Toronto Transit Commission": { cost: 153, conversations: 122, users: 2 },
  "TotalEnergies Marketing & Services": { cost: 176, conversations: 148, users: 3 },
  Wacker: { cost: 493.92, conversations: 218, users: 3 },
  Advantest: { cost: 38, conversations: 23, users: 1 },
  Aramex: { cost: 182, conversations: 129, users: 1 },
  "Littler Associates": { cost: 67, conversations: 44, users: 3 },
  "Mitsui n Co.": { cost: 70, conversations: 57, users: 3 },
  "O-I": { cost: 33.1, conversations: 22, users: 1 },
  "Piramal Consumer Products": { cost: 22, conversations: 22, users: 3 },
  Samsung: { cost: 206, conversations: 178, users: 5 },
  "Sherwin-Williams": { cost: 47.09, conversations: 46, users: 1 },
  Sojitz: { cost: 42, conversations: 40, users: 2 },
  TCS: { cost: 356, conversations: 307, users: 5 },
  TDK: { cost: 257, conversations: 200, users: 3 },
  "Touche Consulting": { cost: 377, conversations: 253, users: 2 },
  "Vardaan Global": { cost: 136, conversations: 93, users: 3 },
  Finagra: { cost: 201, conversations: 232, users: 2 },
  Reliance: { cost: 74, conversations: 57, users: 5 },
  "Linc Consulting": { cost: 27, conversations: 26, users: 1 },
  "Pure Insights": { cost: 32, conversations: 31, users: 1 },
};

// V2 segment enum values
const VALID_SEGMENTS = new Set([
  "paying",
  "prospect",
  "trial",
  "dormant",
  "lost",
  "post_demo",
  "demo_queued",
  "early",
]);

function extractDomain(email: string): string {
  // Take first email if multiple separated by /
  const first = email.split("/")[0].trim();
  const at = first.indexOf("@");
  if (at < 0) return "";
  return first.slice(at + 1).toLowerCase();
}

interface ParsedRow {
  am: string;
  email: string;
  segment: string;
  name: string;
  domain: string;
}

function parseData(): ParsedRow[] {
  if (!DATA) {
    console.log("No DATA provided. Paste your TSV into the DATA constant and re-run.");
    process.exit(0);
  }

  const lines = DATA.split("\n").filter((l) => l.trim());
  const rows: ParsedRow[] = [];
  const seenDomains = new Set<string>();

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 4) continue;

    const [am, email, segment, name] = parts.map((p) => p.trim());
    if (!email || !name) continue;

    const normalizedSegment = segment.toLowerCase().replace(/\s+/g, "_");
    if (!VALID_SEGMENTS.has(normalizedSegment)) {
      console.warn(`Skipping "${name}": invalid segment "${segment}"`);
      continue;
    }

    const domain = extractDomain(email);
    if (!domain) {
      console.warn(`Skipping "${name}": can't extract domain from "${email}"`);
      continue;
    }

    // Dedup by domain — first email wins
    if (seenDomains.has(domain)) {
      console.log(`Dedup: skipping "${name}" (domain ${domain} already seen)`);
      continue;
    }
    seenDomains.add(domain);

    rows.push({ am, email, segment: normalizedSegment, name, domain });
  }

  return rows;
}

async function main() {
  const rows = parseData();
  console.log(`Parsed ${rows.length} unique orgs from TSV data\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    // Cross-reference existing data for cost/conversations/users
    const existing = EXISTING_ORG_DATA[row.name];

    const orgData = {
      name: row.name,
      domain: row.domain,
      segment: row.segment,
      account_manager: row.am || null,
      cost_usd: existing?.cost ?? 0,
      conversations: existing?.conversations ?? 0,
      users: existing?.users ?? 0,
    };

    // Upsert on name: try insert, on conflict update
    const { data: existingOrg } = await sb
      .from("gtm_orgs")
      .select("id")
      .eq("name", row.name)
      .maybeSingle();

    if (existingOrg) {
      // Update existing
      const { error } = await sb
        .from("gtm_orgs")
        .update({
          domain: orgData.domain,
          segment: orgData.segment,
          account_manager: orgData.account_manager,
          cost_usd: orgData.cost_usd,
          conversations: orgData.conversations,
          users: orgData.users,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingOrg.id);

      if (error) {
        console.error(`Error updating "${row.name}":`, error.message);
        errors++;
      } else {
        updated++;
      }
    } else {
      // Insert new
      const { error } = await sb.from("gtm_orgs").insert(orgData);

      if (error) {
        console.error(`Error inserting "${row.name}":`, error.message);
        errors++;
      } else {
        created++;
      }
    }
  }

  console.log(`\nDone!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total processed: ${rows.length}`);

  // Summary by segment
  const segmentCounts: Record<string, number> = {};
  for (const row of rows) {
    segmentCounts[row.segment] = (segmentCounts[row.segment] ?? 0) + 1;
  }
  console.log("\nBy segment:");
  for (const [seg, count] of Object.entries(segmentCounts).sort()) {
    console.log(`  ${seg}: ${count}`);
  }
}

main().catch(console.error);

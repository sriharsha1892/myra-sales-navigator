import type {
  AdaptiveCard,
  AdaptiveCardElement,
  DueStepCardItem,
  ExportSummaryData,
  WeeklyDigestStats,
  AnnouncementData,
} from "./types";

const SCHEMA = "http://adaptivecards.io/schemas/adaptive-card.json";
const VERSION = "1.5";
const ACCENT = "#d4a012"; // Ember
const MUTED = "#6b6b80";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  call: "Call",
  linkedin_connect: "LinkedIn Connect",
  linkedin_inmail: "LinkedIn InMail",
  whatsapp: "WhatsApp",
};

function makeCard(body: AdaptiveCardElement[], actions?: AdaptiveCard["actions"]): AdaptiveCard {
  return {
    type: "AdaptiveCard",
    $schema: SCHEMA,
    version: VERSION,
    body,
    ...(actions?.length ? { actions } : {}),
  };
}

function heading(text: string): AdaptiveCardElement {
  return { type: "TextBlock", text, weight: "Bolder", size: "Medium", wrap: true };
}

function subtitle(text: string): AdaptiveCardElement {
  return { type: "TextBlock", text, size: "Small", color: "Accent", wrap: true, isSubtle: true };
}

function divider(): AdaptiveCardElement {
  return { type: "TextBlock", text: " ", separator: true, spacing: "Small" };
}

// ---------------------------------------------------------------------------
// 1. Due Steps (personal DM — daily digest)
// ---------------------------------------------------------------------------
export function buildDueStepsCard(
  items: DueStepCardItem[],
  userName: string,
  appUrl: string
): AdaptiveCard {
  const body: AdaptiveCardElement[] = [
    heading(`Good morning, ${userName}`),
    subtitle(`You have ${items.length} outreach step${items.length !== 1 ? "s" : ""} due today`),
    divider(),
  ];

  // Group by company
  const byCompany = new Map<string, DueStepCardItem[]>();
  for (const item of items) {
    const list = byCompany.get(item.companyName) ?? [];
    list.push(item);
    byCompany.set(item.companyName, list);
  }

  for (const [company, steps] of byCompany) {
    body.push({
      type: "TextBlock",
      text: `**${company}**`,
      spacing: "Small",
      wrap: true,
    });

    for (const step of steps) {
      const label = CHANNEL_LABELS[step.channel] ?? step.channel;
      body.push({
        type: "TextBlock",
        text: `\u2022 ${step.contactName} — ${label} (Step ${step.stepNumber}/${step.totalSteps})`,
        size: "Small",
        wrap: true,
        isSubtle: true,
      });
    }
  }

  return makeCard(body, [
    { type: "Action.OpenUrl", title: "Open Sales Navigator", url: appUrl },
  ]);
}

// ---------------------------------------------------------------------------
// 2. Export Summary (shared channel — on export)
// ---------------------------------------------------------------------------
export function buildExportSummaryCard(data: ExportSummaryData, appUrl: string): AdaptiveCard {
  const formatLabel = data.format === "excel" ? "Excel" : data.format === "csv" ? "CSV" : "clipboard";
  return makeCard(
    [
      heading("Contact Export"),
      {
        type: "TextBlock",
        text: `**${data.userName}** exported **${data.contactCount}** contacts from **${data.companyDomain}** (${formatLabel})`,
        wrap: true,
      },
      {
        type: "TextBlock",
        text: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        size: "Small",
        isSubtle: true,
      },
    ],
    [
      { type: "Action.OpenUrl", title: "View in Navigator", url: appUrl },
    ]
  );
}

// ---------------------------------------------------------------------------
// 3. Weekly Digest (shared channel — Monday morning)
// ---------------------------------------------------------------------------
export function buildWeeklyDigestCard(stats: WeeklyDigestStats, appUrl: string): AdaptiveCard {
  return makeCard(
    [
      heading("Weekly Team Digest"),
      subtitle(stats.period),
      divider(),
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              { type: "TextBlock", text: String(stats.exportsCount), weight: "Bolder", size: "ExtraLarge", horizontalAlignment: "Center" },
              { type: "TextBlock", text: "Exports", size: "Small", isSubtle: true, horizontalAlignment: "Center" },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              { type: "TextBlock", text: String(stats.sequencesStarted), weight: "Bolder", size: "ExtraLarge", horizontalAlignment: "Center" },
              { type: "TextBlock", text: "Sequences", size: "Small", isSubtle: true, horizontalAlignment: "Center" },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              { type: "TextBlock", text: String(stats.stepsCompleted), weight: "Bolder", size: "ExtraLarge", horizontalAlignment: "Center" },
              { type: "TextBlock", text: "Steps Done", size: "Small", isSubtle: true, horizontalAlignment: "Center" },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              { type: "TextBlock", text: String(stats.companiesDiscovered), weight: "Bolder", size: "ExtraLarge", horizontalAlignment: "Center" },
              { type: "TextBlock", text: "Discovered", size: "Small", isSubtle: true, horizontalAlignment: "Center" },
            ],
          },
        ],
      },
      divider(),
      {
        type: "TextBlock",
        text: `Active users: ${stats.activeUsers.join(", ") || "None"}`,
        size: "Small",
        isSubtle: true,
        wrap: true,
      },
    ],
    [
      { type: "Action.OpenUrl", title: "Open Navigator", url: appUrl },
    ]
  );
}

// ---------------------------------------------------------------------------
// 4. General Announcement (shared channel + optional DMs)
// ---------------------------------------------------------------------------
export function buildAnnouncementCard(data: AnnouncementData): AdaptiveCard {
  return makeCard([
    heading(data.title),
    {
      type: "TextBlock",
      text: data.body,
      wrap: true,
    },
    divider(),
    {
      type: "TextBlock",
      text: `— ${data.author}`,
      size: "Small",
      isSubtle: true,
    },
  ]);
}

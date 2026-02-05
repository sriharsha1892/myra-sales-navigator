const copyBank: Record<string, string[]> = {
  empty_results: [
    "Nothing here yet — try a broader search or fewer filters.",
    "No matches this time. Loosen a filter or try a different angle.",
    "Zero hits. Maybe cast a wider net?",
  ],
  empty_contacts_list: [
    "No contacts loaded yet. Run a search to populate this list.",
    "Contact list is empty — search results will bring contacts in.",
    "No contacts to show. Try searching for companies first.",
  ],
  empty_dossier_contacts: [
    "No contacts yet for this company. Try searching for it directly, or check back later.",
    "We don't have contacts here yet — a direct search might surface them.",
    "Contact data hasn't landed yet. Try a fresh search or check back soon.",
  ],
  empty_dossier_signals: [
    "No recent activity found. This company may be quiet right now.",
    "Nothing brewing here — no hiring, funding, or expansion signals detected.",
    "Radio silence from this one. No signals in the last few weeks.",
  ],
  empty_card_signals: [
    "No signals yet",
    "Quiet on the wire",
    "Nothing detected",
  ],
  search_loading: [
    "Scanning sources...",
    "Pulling from Exa, Apollo, and more...",
    "Crunching data across providers...",
  ],
  search_loading_exa: [
    "Querying Exa for semantic matches...",
    "Searching Exa's neural index...",
  ],
  search_loading_apollo: [
    "Fetching Apollo contacts...",
    "Pulling structured data from Apollo...",
  ],
  search_loading_hubspot: [
    "Checking HubSpot for CRM history...",
    "Pulling HubSpot relationship data...",
  ],
  search_loading_freshsales: [
    "Checking Freshsales for deal status...",
  ],
  dossier_loading: [
    "Building the full picture...",
    "Assembling dossier from all sources...",
    "Pulling contacts, signals, and history...",
  ],
  export_loading: [
    "Preparing your export...",
    "Packaging contacts for export...",
    "Getting everything ready...",
  ],
  exclusion_success: [
    "N companies excluded. They won't show up again.",
    "Done — N companies moved to the exclusion list.",
    "Excluded N companies from future results.",
  ],
  copy_success: [
    "Copied to clipboard.",
    "On your clipboard, ready to paste.",
    "Copied — go paste it somewhere useful.",
  ],
  export_success: [
    "Exported N contacts. Go close some deals.",
    "N contacts exported successfully.",
    "All N contacts are in your export. Ship it.",
  ],
  bulk_status_update: [
    "Updated N companies. Pipeline is looking sharper.",
    "Status changed for N companies.",
    "N companies updated. Nice housekeeping.",
  ],
  search_error: [
    "Search stumbled. The myRA team is looking into it (and pointing fingers at each other).",
    "Search hit a wall. The myRA team blames the internet — we're not sure either.",
    "Couldn't complete the search. The myRA team is on it... after their coffee break.",
  ],
  save_error: [
    "Couldn't save that. The myRA team promises it'll work next time.",
    "Save failed. The myRA team is investigating (read: refreshing their own browsers).",
  ],
  network_error: [
    "Lost the connection. The myRA team swears it's not our fault... probably.",
    "Can't reach the server. Even the myRA team is confused right now.",
    "Network hiccup. The myRA team checked — our servers are fine, blame your WiFi.",
  ],
  missing_data: [
    "Not available yet",
    "Data pending",
    "No data found",
  ],
  apollo_rate_limit: [
    "Apollo needs a breather — we asked too many questions. Give it a minute.",
  ],
  contacts_fetch_failed: [
    "Couldn't load contacts. Either Apollo is napping or the internet is being dramatic.",
  ],
  export_failed: [
    "Export didn't quite make it. The myRA team promises to do better next time.",
  ],
  export_no_email_skip: [
    "{count} contact(s) skipped — no email found. The myRA team tried.",
  ],
  session_expired: [
    "Your session wandered off. Log back in — the myRA team needs to know it's you.",
  ],
  empty_results_suggestion: [
    "No matches. Try loosening a filter or broadening your search — even the myRA team can't find what doesn't exist.",
  ],
  login_wrong_password: [
    "That password isn't right. The myRA team triple-checked.",
  ],
  login_pick_name: [
    "Pick your name so we know who's wielding this power.",
  ],
  note_save_failed: [
    "Note didn't save. The myRA team is looking into it.",
  ],
  bulk_action_failed: [
    "Bulk action failed. The myRA team is reviewing what went wrong.",
  ],
  empty_contacts_tab: [
    "Select companies first, then switch to Contacts to see their people.",
    "No companies selected yet. Search and select companies to populate contacts.",
  ],
  exported_tab_empty: [
    "This tab shows contacts you've already exported — clipboard, CSV, or Excel.",
    "No exports yet. Export contacts from a company dossier and they'll show up here.",
  ],
  error_timeout: [
    "Request timed out. The API took too long to respond — try again.",
  ],
  error_rate_limited: [
    "Rate limited — too many requests. Wait a moment and try again.",
  ],
  error_generic: [
    "Something went wrong. The myRA team is looking into it.",
  ],
  export_fallback: [
    "Server export failed — used client-side fallback. Data may differ slightly.",
  ],
};

export function pick(key: string, context?: Record<string, string>): string {
  const messages = copyBank[key];
  if (!messages || messages.length === 0) return key;
  let msg = messages[Math.floor(Math.random() * messages.length)];
  if (context) {
    for (const [k, v] of Object.entries(context)) {
      msg = msg.replace(`{${k}}`, v);
    }
  }
  return msg;
}

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
    "Search hit a snag. Give it another shot.",
    "Something went wrong with the search. Try again?",
    "Search failed — could be a network hiccup. Retry when ready.",
  ],
  save_error: [
    "Couldn't save that. Try again in a moment.",
    "Save failed — check your connection and retry.",
    "Something went wrong saving. Give it another go.",
  ],
  network_error: [
    "Network issue. Check your connection.",
    "Can't reach the server right now. Try again shortly.",
    "Connection dropped — retry when you're back online.",
  ],
  missing_data: [
    "Not available yet",
    "Data pending",
    "No data found",
  ],
};

export function pick(key: string): string {
  const messages = copyBank[key];
  if (!messages || messages.length === 0) return key;
  return messages[Math.floor(Math.random() * messages.length)];
}

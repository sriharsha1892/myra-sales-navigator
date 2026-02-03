/**
 * Simple allowlist-based HTML sanitizer for internal update content.
 * Strips all tags except a safe set. Does not handle edge cases like
 * malformed HTML or attribute injection on allowed tags — acceptable
 * for admin-authored content in an internal tool.
 */

const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "ul", "ol", "li",
  "strong", "b", "em", "i", "u",
  "a",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "span", "div",
  "blockquote", "pre", "code",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

/**
 * Strip HTML to only allowed tags and attributes.
 * Works via regex — not DOM-based, so it works on the server too.
 */
export function sanitizeHtml(html: string): string {
  // Remove script/style/iframe blocks entirely
  let cleaned = html.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Remove self-closing dangerous tags
  cleaned = cleaned.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*\/?>/gi, "");

  // Process remaining tags
  cleaned = cleaned.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lowerTag)) return "";

    const isClosing = match.startsWith("</");
    if (isClosing) return `</${lowerTag}>`;

    // Filter attributes
    const allowedAttrSet = ALLOWED_ATTRS[lowerTag];
    if (!allowedAttrSet || !attrs.trim()) {
      return `<${lowerTag}>`;
    }

    const safeAttrs: string[] = [];
    const attrRegex = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
      if (allowedAttrSet.has(attrName)) {
        // Block javascript: URLs in href
        if (attrName === "href" && /^\s*javascript\s*:/i.test(attrValue)) continue;
        safeAttrs.push(`${attrName}="${attrValue}"`);
      }
    }

    return safeAttrs.length > 0
      ? `<${lowerTag} ${safeAttrs.join(" ")}>`
      : `<${lowerTag}>`;
  });

  // Remove on* event handlers that might have survived
  cleaned = cleaned.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  return cleaned;
}

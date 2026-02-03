"use client";

import React from "react";

const STOPWORDS = new Set([
  "the", "and", "or", "in", "of", "for", "with", "a", "an",
  "to", "is", "are", "was", "were", "be", "been", "being",
  "that", "this", "it", "at", "by", "from", "on", "as",
]);

interface HighlightTermsProps {
  text: string;
  query: string | null;
  className?: string;
}

export function HighlightTerms({ text, query, className }: HighlightTermsProps) {
  if (!query || !text) {
    return <span className={className}>{text}</span>;
  }

  const terms = query
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t.toLowerCase()));

  if (terms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(`\\b(${terms.map(escapeRegex).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const isMatch = terms.some(
          (t) => part.toLowerCase() === t.toLowerCase()
        );
        return isMatch ? (
          <mark
            key={i}
            className="bg-accent-primary/20 text-accent-primary rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </span>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

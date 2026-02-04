"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useStore } from "@/lib/navigator/store";

function formatIST(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

interface DomainPreview {
  domain: string;
  x: number;
  y: number;
}

export function MentionNotifications() {
  const { unreadMentions, clearMentions } = useAuth();
  const selectCompany = useStore((s) => s.selectCompany);
  const companies = useStore((s) => s.companies);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hover, setHover] = useState<DomainPreview | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Click-outside-to-close
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const showPreview = useCallback((e: React.MouseEvent, domain: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHover({ domain, x: rect.left, y: rect.top - 8 });
    }, 200);
  }, []);

  const hidePreview = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHover(null);
  }, []);

  if (unreadMentions.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      {/* Hover preview */}
      {hover && (() => {
        const company = companies.find((c) => c.domain === hover.domain);
        if (!company) return null;
        return (
          <div
            className="pointer-events-none fixed z-30 rounded-card border border-surface-3 bg-surface-1 px-3 py-2 shadow-md"
            style={{ left: hover.x, top: hover.y, transform: "translateY(-100%)" }}
          >
            <p className="text-xs font-medium text-text-primary">{hover.domain}</p>
            <p className="text-[10px] text-text-tertiary">{company.employeeCount?.toLocaleString()} emp</p>
            {company.signals[0] && (
              <p className="text-[10px] text-accent-secondary">{company.signals[0].title}</p>
            )}
          </div>
        );
      })()}

      <button
        onClick={() => setOpen(!open)}
        aria-label={`Unread mentions (${unreadMentions.length})`}
        aria-expanded={open}
        className="relative rounded-input border border-surface-3 bg-surface-1 px-2 py-1 text-xs text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary"
      >
        @
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-primary text-[9px] font-bold text-text-inverse">
          {unreadMentions.length}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-card border border-surface-3 bg-surface-1 p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase text-text-tertiary">
              Unread Mentions
            </p>
            <button
              onClick={() => { clearMentions(); setOpen(false); }}
              className="text-[10px] text-text-tertiary hover:text-accent-primary"
            >
              Clear all
            </button>
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {unreadMentions.map((mention) => (
              <button
                key={mention.noteId}
                role="menuitem"
                onClick={() => {
                  selectCompany(mention.companyDomain);
                  setOpen(false);
                }}
                onMouseEnter={(e) => showPreview(e, mention.companyDomain)}
                onMouseLeave={hidePreview}
                className="block w-full rounded-input border border-surface-3 bg-surface-2 p-2 text-left transition-colors hover:border-accent-primary/30"
              >
                <p className="text-xs text-text-primary">
                  <span className="font-medium text-accent-primary">{mention.authorName}</span>
                  {" mentioned you on "}
                  <span className="font-medium text-accent-secondary">{mention.companyDomain}</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-text-secondary">
                  {mention.content}
                </p>
                <p className="mt-0.5 text-[10px] text-text-tertiary">
                  {formatIST(mention.createdAt)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

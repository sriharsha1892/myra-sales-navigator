"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import type { ContactSortField } from "@/lib/types";

const SENIORITY_OPTIONS = [
  { value: "c_level", label: "C-Level" },
  { value: "vp", label: "VP" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
] as const;

const SOURCE_OPTIONS = [
  { value: "apollo", label: "Apollo" },
  { value: "hubspot", label: "HubSpot" },
  { value: "freshsales", label: "Freshsales" },
] as const;

const SORT_OPTIONS: { value: ContactSortField; label: string }[] = [
  { value: "seniority", label: "Seniority" },
  { value: "email_confidence", label: "Email confidence" },
  { value: "icp_score", label: "Company ICP" },
  { value: "last_contacted", label: "Last contacted" },
];

const ALL_FIELDS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "title", label: "Title" },
  { key: "seniority", label: "Seniority" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "lastContacted", label: "Last contacted" },
  { key: "sources", label: "Sources" },
] as const;

export function ContactFilters() {
  const contactFilters = useStore((s) => s.contactFilters);
  const setContactFilters = useStore((s) => s.setContactFilters);
  const contactVisibleFields = useStore((s) => s.contactVisibleFields);
  const setContactVisibleFields = useStore((s) => s.setContactVisibleFields);
  const contactGroupsCollapsed = useStore((s) => s.contactGroupsCollapsed);
  const collapseAllContactGroups = useStore((s) => s.collapseAllContactGroups);
  const expandAllContactGroups = useStore((s) => s.expandAllContactGroups);
  const contactsByDomain = useStore((s) => s.contactsByDomain);

  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);

  // Close gear dropdown on outside click
  useEffect(() => {
    if (!gearOpen) return;
    const handler = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setGearOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [gearOpen]);

  const toggleSeniority = (val: string) => {
    const current = contactFilters.seniority;
    const next = current.includes(val)
      ? current.filter((s) => s !== val)
      : [...current, val];
    setContactFilters({ seniority: next });
  };

  const toggleSource = (val: string) => {
    const current = contactFilters.sources;
    const next = current.includes(val)
      ? current.filter((s) => s !== val)
      : [...current, val];
    setContactFilters({ sources: next });
  };

  const toggleField = (key: string) => {
    const next = new Set(contactVisibleFields);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setContactVisibleFields(next);
  };

  const allCollapsed = Object.keys(contactsByDomain).length > 0 &&
    Object.keys(contactsByDomain).every((d) => contactGroupsCollapsed[d]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-surface-3 bg-surface-0 px-4 py-2">
      {/* Seniority chips */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-text-tertiary">Seniority:</span>
        {SENIORITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleSeniority(opt.value)}
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors",
              contactFilters.seniority.includes(opt.value)
                ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Has Email toggle */}
      <button
        onClick={() => setContactFilters({ hasEmail: !contactFilters.hasEmail })}
        className={cn(
          "rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors",
          contactFilters.hasEmail
            ? "border-accent-secondary bg-accent-secondary/10 text-accent-secondary"
            : "border-surface-3 text-text-tertiary hover:text-text-secondary"
        )}
      >
        Has email
      </button>

      {/* Source chips */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-text-tertiary">Source:</span>
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleSource(opt.value)}
            className={cn(
              "rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors",
              contactFilters.sources.includes(opt.value)
                ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                : "border-surface-3 text-text-tertiary hover:text-text-secondary"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-text-tertiary">Sort:</span>
        <select
          value={contactFilters.sortBy}
          onChange={(e) => setContactFilters({ sortBy: e.target.value as ContactSortField })}
          className="rounded-input border border-surface-3 bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-primary focus:border-accent-primary focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Spacer */}
      <div className="ml-auto flex items-center gap-2">
        {/* Collapse/Expand all toggle */}
        <button
          onClick={allCollapsed ? expandAllContactGroups : collapseAllContactGroups}
          className="text-[10px] text-text-tertiary hover:text-text-secondary"
          title={allCollapsed ? "Expand all groups" : "Collapse all groups"}
        >
          {allCollapsed ? "Expand all" : "Collapse all"}
        </button>

        {/* Gear icon — field config */}
        <div className="relative" ref={gearRef}>
          <button
            onClick={() => setGearOpen(!gearOpen)}
            className="flex items-center justify-center rounded p-1 text-text-tertiary hover:bg-surface-2 hover:text-text-secondary"
            title="Configure visible fields"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {gearOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-card border border-surface-3 bg-surface-1 p-2 shadow-lg">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                Visible fields
              </p>
              {ALL_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-text-secondary hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={contactVisibleFields.has(field.key)}
                    onChange={() => toggleField(field.key)}
                    className="h-3 w-3 rounded accent-accent-primary"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

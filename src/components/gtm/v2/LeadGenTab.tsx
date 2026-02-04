"use client";

import type { GtmEntry } from "@/lib/gtm/v2-types";

interface LeadGenTabProps {
  values: {
    inboundTotal: number;
    inboundActive: number;
    inboundJunk: number;
    outboundLeads: number;
    outboundReached: number;
    outboundFollowed: number;
    outboundQualified: number;
    apolloContacts: number;
    apolloNote: string;
  };
  onChange: (field: string, value: number | string) => void;
  previous: GtmEntry | null;
}

export function LeadGenTab({ values, onChange, previous }: LeadGenTabProps) {
  return (
    <div className="space-y-6">
      {/* Inbound */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Inbound</h3>
        <div className="grid grid-cols-3 gap-4">
          <NumField
            label="Total"
            value={values.inboundTotal}
            prev={previous?.inboundTotal}
            onChange={(v) => onChange("inboundTotal", v)}
          />
          <NumField
            label="Active"
            value={values.inboundActive}
            prev={previous?.inboundActive}
            onChange={(v) => onChange("inboundActive", v)}
          />
          <NumField
            label="Junk"
            value={values.inboundJunk}
            prev={previous?.inboundJunk}
            onChange={(v) => onChange("inboundJunk", v)}
          />
        </div>
      </div>

      {/* Outbound */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Outbound Funnel</h3>
        <div className="grid grid-cols-4 gap-4">
          <NumField
            label="Leads"
            value={values.outboundLeads}
            prev={previous?.outboundLeads}
            onChange={(v) => onChange("outboundLeads", v)}
          />
          <NumField
            label="Reached"
            value={values.outboundReached}
            prev={previous?.outboundReached}
            onChange={(v) => onChange("outboundReached", v)}
          />
          <NumField
            label="Followed"
            value={values.outboundFollowed}
            prev={previous?.outboundFollowed}
            onChange={(v) => onChange("outboundFollowed", v)}
          />
          <NumField
            label="Qualified"
            value={values.outboundQualified}
            prev={previous?.outboundQualified}
            onChange={(v) => onChange("outboundQualified", v)}
          />
        </div>
      </div>

      {/* Apollo */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Apollo</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumField
            label="Contacts"
            value={values.apolloContacts}
            prev={previous?.apolloContacts}
            onChange={(v) => onChange("apolloContacts", v)}
          />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Note</label>
            <input
              value={values.apolloNote}
              onChange={(e) => onChange("apolloNote", e.target.value)}
              placeholder="Apollo status note..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  prev,
  onChange,
}: {
  label: string;
  value: number;
  prev?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs text-gray-500">{label}</label>
        {prev !== undefined && prev > 0 && (
          <span className="text-[10px] text-gray-400 font-mono tabular-nums">
            prev: {prev}
          </span>
        )}
      </div>
      <input
        type="number"
        value={value || ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
        }}
        min={0}
        step={1}
        onKeyDown={(e) => {
          if (e.key === "-" || e.key === "e" || e.key === ".") e.preventDefault();
        }}
        className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 tabular-nums"
      />
    </div>
  );
}

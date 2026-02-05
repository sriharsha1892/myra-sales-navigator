"use client";

import type { GtmEntry } from "@/lib/gtm/v2-types";
import { SmartNumField } from "./SmartNumField";

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
          <SmartNumField
            label="Total"
            value={values.inboundTotal}
            baseValue={previous?.inboundTotal}
            defaultMode="delta"
            onChange={(v) => onChange("inboundTotal", v)}
          />
          <SmartNumField
            label="Active"
            value={values.inboundActive}
            baseValue={previous?.inboundActive}
            defaultMode="delta"
            onChange={(v) => onChange("inboundActive", v)}
          />
          <SmartNumField
            label="Junk"
            value={values.inboundJunk}
            baseValue={previous?.inboundJunk}
            defaultMode="delta"
            onChange={(v) => onChange("inboundJunk", v)}
          />
        </div>
        {values.inboundJunk > values.inboundTotal && values.inboundTotal > 0 && (
          <p className="text-[11px] text-amber-600 mt-1">
            Junk ({values.inboundJunk}) exceeds total ({values.inboundTotal})
          </p>
        )}
        {values.inboundJunk <= values.inboundTotal && (values.inboundActive + values.inboundJunk) > values.inboundTotal && values.inboundTotal > 0 && (
          <p className="text-[11px] text-amber-600 mt-1">
            Active + Junk ({values.inboundActive + values.inboundJunk}) exceeds total ({values.inboundTotal})
          </p>
        )}
      </div>

      {/* Outbound */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Outbound Funnel</h3>
        <div className="grid grid-cols-4 gap-4">
          <SmartNumField
            label="Leads"
            value={values.outboundLeads}
            baseValue={previous?.outboundLeads}
            defaultMode="delta"
            onChange={(v) => onChange("outboundLeads", v)}
          />
          <SmartNumField
            label="Reached"
            value={values.outboundReached}
            baseValue={previous?.outboundReached}
            defaultMode="delta"
            onChange={(v) => onChange("outboundReached", v)}
          />
          <SmartNumField
            label="Followed"
            value={values.outboundFollowed}
            baseValue={previous?.outboundFollowed}
            defaultMode="delta"
            onChange={(v) => onChange("outboundFollowed", v)}
          />
          <SmartNumField
            label="Qualified"
            value={values.outboundQualified}
            baseValue={previous?.outboundQualified}
            defaultMode="delta"
            onChange={(v) => onChange("outboundQualified", v)}
          />
        </div>
      </div>

      {/* Apollo */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Apollo</h3>
        <div className="grid grid-cols-2 gap-4">
          <SmartNumField
            label="Contacts"
            value={values.apolloContacts}
            baseValue={previous?.apolloContacts}
            defaultMode="absolute"
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

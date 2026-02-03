"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useGtmLeadGen, useUpsertLeadGen } from "@/hooks/useGtmDashboardData";

interface FieldDef {
  key: string;
  label: string;
  type: "number" | "text";
}

const FIELDS: FieldDef[] = [
  { key: "inboundTotal", label: "Inbound Total", type: "number" },
  { key: "inboundActive", label: "Inbound Active", type: "number" },
  { key: "inboundJunk", label: "Inbound Junk", type: "number" },
  { key: "outboundLeads", label: "Outbound Leads", type: "number" },
  { key: "outboundReached", label: "Outbound Reached", type: "number" },
  { key: "outboundFollowed", label: "Outbound Followed Up", type: "number" },
  { key: "outboundQualified", label: "Outbound Qualified", type: "number" },
  { key: "apolloContacts", label: "Apollo Contacts", type: "number" },
  { key: "apolloStatus", label: "Apollo Status", type: "text" },
];

export function LeadGenTab() {
  const { data: leadGen } = useGtmLeadGen();
  const upsert = useUpsertLeadGen();

  const [values, setValues] = useState<Record<string, string | number>>({});
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (leadGen) {
      const v: Record<string, string | number> = {};
      FIELDS.forEach((f) => {
        v[f.key] = (leadGen as unknown as Record<string, unknown>)[f.key] as
          | string
          | number;
      });
      setValues(v);
    }
  }, [leadGen]);

  const handleBlur = useCallback(
    (key: string, val: string) => {
      clearTimeout(debounceRef.current);
      const updated = { ...values, [key]: val };
      setValues(updated);

      debounceRef.current = setTimeout(() => {
        const payload: Record<string, unknown> = {};
        if (leadGen?.id) payload.id = leadGen.id;
        FIELDS.forEach((f) => {
          const v = updated[f.key];
          payload[f.key] = f.type === "number" ? Number(v) || 0 : v;
        });
        upsert.mutate(payload as Parameters<typeof upsert.mutate>[0]);
      }, 300);
    },
    [values, leadGen, upsert]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h4 className="text-sm font-semibold text-gray-900 mb-4">
        Lead Generation Numbers
      </h4>
      <p className="text-xs text-gray-400 mb-4">
        Values auto-save on blur
      </p>
      <div className="grid grid-cols-3 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {f.label}
            </label>
            <input
              type={f.type === "number" ? "number" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              onBlur={(e) => handleBlur(f.key, e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

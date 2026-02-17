"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import { calculateIcpScore } from "@/lib/navigator/scoring";
import type { IcpScoreResult } from "@/lib/navigator/scoring";
import type { IcpWeights } from "@/lib/navigator/types";

export function IcpWeightsSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const weights = config.icpWeights;

  const fields: { key: keyof typeof weights; label: string }[] = [
    { key: "verticalMatch", label: "Vertical Match" },
    { key: "sizeMatch", label: "Size Match" },
    { key: "regionMatch", label: "Region Match" },
    { key: "buyingSignals", label: "Buying Signals" },
    { key: "negativeSignals", label: "Negative Signals" },
    { key: "exaRelevance", label: "Exa Relevance" },
    { key: "hubspotLead", label: "HubSpot Lead" },
    { key: "hubspotCustomer", label: "HubSpot Customer" },
    { key: "freshsalesLead", label: "Freshsales Lead" },
    { key: "freshsalesCustomer", label: "Freshsales Customer" },
    { key: "freshsalesRecentContact", label: "Freshsales Recent Contact" },
  ];

  const handleChange = (key: keyof typeof weights, value: number) => {
    updateConfig({ icpWeights: { ...weights, [key]: value } });
  };

  const total = Object.values(weights).reduce((a, b) => a + Math.abs(b), 0);

  return (
    <AdminSection title="ICP Scoring Weights" description="Controls how companies are scored. Positive = bonus for matching, negative = penalty. The final score (0-100) appears on every company card.">
      <div className="space-y-3">
        {fields.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-40 text-xs text-text-secondary">{label}</span>
            <input
              type="range"
              min={-50}
              max={50}
              value={weights[key]}
              onChange={(e) => handleChange(key, parseInt(e.target.value))}
              className="flex-1 accent-accent-primary"
            />
            <input
              type="number"
              value={weights[key]}
              onChange={(e) => handleChange(key, parseInt(e.target.value) || 0)}
              className="w-16 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-center font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-tertiary">
        Sum of absolute weights: {total}
      </p>
      {(() => {
        const positiveSum = Object.values(weights).reduce((a, b) => a + Math.max(b, 0), 0);
        return positiveSum > 150 ? (
          <p className="text-[10px] text-warning">
            Total positive weights: {positiveSum}. Recommended: 100-150 for balanced scoring.
          </p>
        ) : null;
      })()}
      <button
        onClick={() =>
          updateConfig({
            icpWeights: {
              verticalMatch: 25, sizeMatch: 20, regionMatch: 15,
              buyingSignals: 15, negativeSignals: -10, exaRelevance: 10,
              hubspotLead: 10, hubspotCustomer: 5,
              freshsalesLead: 10, freshsalesCustomer: -40, freshsalesRecentContact: 15,
              freshsalesTagBoost: 15, freshsalesTagPenalty: -20, freshsalesDealStalled: -10,
            },
          })
        }
        className="mt-2 text-xs text-text-tertiary hover:text-text-secondary"
      >
        Reset to Defaults
      </button>

      <IcpPreviewPanel weights={weights} />
    </AdminSection>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Test ICP scoring against a company
// ---------------------------------------------------------------------------

function IcpPreviewPanel({ weights }: { weights: IcpWeights }) {
  const searchResults = useStore((s) => s.searchResults);
  const adminConfig = useStore((s) => s.adminConfig);

  const [previewDomain, setPreviewDomain] = useState("");
  const [previewResult, setPreviewResult] = useState<IcpScoreResult | null>(null);

  const companies = useMemo(() => searchResults ?? [], [searchResults]);

  const scoringContext = useMemo(() => ({
    verticals: adminConfig.verticals,
    regions: [] as string[],
    sizes: [] as string[],
    signals: adminConfig.signalTypes.filter((s) => s.enabled).map((s) => s.type),
    tagScoringRules: adminConfig.freshsalesSettings?.tagScoringRules,
    stalledDealThresholdDays: adminConfig.freshsalesSettings?.stalledDealThresholdDays,
  }), [adminConfig.verticals, adminConfig.signalTypes, adminConfig.freshsalesSettings?.tagScoringRules, adminConfig.freshsalesSettings?.stalledDealThresholdDays]);

  const handleScore = () => {
    const company = companies.find((c) => c.domain === previewDomain);
    if (!company) return;
    const result = calculateIcpScore(company, weights, scoringContext);
    setPreviewResult(result);
  };

  // Auto-update preview when weights change
  const selectedCompany = companies.find((c) => c.domain === previewDomain);
  const liveResult = useMemo(() => {
    if (!selectedCompany) return null;
    return calculateIcpScore(selectedCompany, weights, scoringContext);
  }, [selectedCompany, weights, scoringContext]);

  const displayResult = liveResult ?? previewResult;

  const scoreBadgeColor = (score: number) => {
    if (score >= 70) return "bg-success/15 text-success";
    if (score >= 40) return "bg-warning/15 text-warning";
    return "bg-surface-3 text-text-tertiary";
  };

  return (
    <div className="mt-4 rounded-input border border-surface-3 bg-surface-0 p-4">
      <h3 className="mb-3 text-xs font-semibold text-text-secondary">Test Scoring</h3>

      {companies.length === 0 ? (
        <p className="text-[11px] text-text-tertiary">
          Run a search first to test scoring against real companies.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <select
              value={previewDomain}
              onChange={(e) => setPreviewDomain(e.target.value)}
              className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="">Select a company...</option>
              {companies.map((c) => (
                <option key={c.domain} value={c.domain}>
                  {c.name} ({c.domain})
                </option>
              ))}
            </select>
            <button
              onClick={handleScore}
              disabled={!previewDomain}
              className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Score
            </button>
          </div>

          {displayResult && (
            <div className="mt-3">
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-badge px-2 py-0.5 font-mono text-sm font-semibold ${scoreBadgeColor(displayResult.score)}`}>
                  {displayResult.score}
                </span>
                <span className="text-[10px] text-text-tertiary">
                  / 100
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-3 text-left text-[10px] uppercase tracking-wide text-text-tertiary">
                    <th className="pb-1.5 pr-2">Factor</th>
                    <th className="pb-1.5 pr-2 text-right">Points</th>
                    <th className="pb-1.5 text-right">Matched</th>
                  </tr>
                </thead>
                <tbody>
                  {displayResult.breakdown.map((item, i) => (
                    <tr key={i} className="border-b border-surface-3/30 last:border-0">
                      <td className="py-1 pr-2 text-text-secondary">{item.factor}</td>
                      <td className={`py-1 pr-2 text-right font-mono ${item.points > 0 ? "text-success" : item.points < 0 ? "text-danger" : "text-text-tertiary"}`}>
                        {item.points > 0 ? `+${item.points}` : item.points}
                      </td>
                      <td className="py-1 text-right">
                        {item.matched ? (
                          <span className="text-success">Yes</span>
                        ) : (
                          <span className="text-text-tertiary">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

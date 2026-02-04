"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { EmailVerificationSettings } from "@/lib/navigator/types";

export function EmailVerificationSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const settings = config.emailVerification;

  const update = (partial: Partial<EmailVerificationSettings>) => {
    updateConfig({ emailVerification: { ...settings, ...partial } });
  };

  return (
    <AdminSection title="Email Verification (Clearout)" description="Controls when and how email addresses are checked for validity before export.">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">
            Clearout Threshold (min score to consider verified)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.clearoutThreshold}
              onChange={(e) => update({ clearoutThreshold: parseInt(e.target.value) })}
              className="flex-1 accent-accent-primary"
            />
            <span className="w-12 text-right font-mono text-xs text-text-secondary">
              {settings.clearoutThreshold}
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">
            Auto-verify if Apollo confidence above
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.autoVerifyAboveConfidence}
              onChange={(e) => update({ autoVerifyAboveConfidence: parseInt(e.target.value) })}
              className="flex-1 accent-accent-primary"
            />
            <span className="w-12 text-right font-mono text-xs text-text-secondary">
              {settings.autoVerifyAboveConfidence}%
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">
            Daily Max Verifications
          </label>
          <input
            type="number"
            value={settings.dailyMaxVerifications}
            onChange={(e) => update({ dailyMaxVerifications: parseInt(e.target.value) || 0 })}
            className="w-32 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.verifyOnContactLoad}
            onChange={(e) => update({ verifyOnContactLoad: e.target.checked })}
            className="h-3.5 w-3.5 rounded accent-accent-primary"
          />
          <span className="text-xs text-text-primary">Verify emails when contacts are loaded (uses credits)</span>
        </label>

        {/* Email Finder (Clearout as contact source) */}
        <div className="border-t border-surface-3 pt-4">
          <h4 className="mb-3 text-xs font-semibold text-text-primary">Email Finder</h4>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.emailFinderEnabled}
              onChange={(e) => update({ emailFinderEnabled: e.target.checked })}
              className="h-3.5 w-3.5 rounded accent-accent-primary"
            />
            <span className="text-xs text-text-primary">Enable &quot;Find missing emails&quot; button in dossier</span>
          </label>

          <div className="mt-3">
            <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">
              Max Lookups Per Batch
            </label>
            <input
              type="number"
              value={settings.emailFinderMaxPerBatch}
              onChange={(e) => update({ emailFinderMaxPerBatch: parseInt(e.target.value) || 1 })}
              min={1}
              max={50}
              className="w-32 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-[10px] font-medium uppercase text-text-tertiary">
              Min Confidence to Skip (contacts above this won&apos;t be looked up)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={settings.emailFinderMinConfidenceToSkip}
                onChange={(e) => update({ emailFinderMinConfidenceToSkip: parseInt(e.target.value) })}
                className="flex-1 accent-accent-primary"
              />
              <span className="w-12 text-right font-mono text-xs text-text-secondary">
                {settings.emailFinderMinConfidenceToSkip}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminSection>
  );
}

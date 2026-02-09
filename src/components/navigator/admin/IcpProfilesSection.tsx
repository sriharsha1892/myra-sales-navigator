"use client";

import { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { IcpProfile } from "@/lib/navigator/types";

const REGION_OPTIONS = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"];
const SIGNAL_OPTIONS = ["hiring", "funding", "expansion", "news"];

function ProfileEditor({
  profile,
  verticalOptions,
  onSave,
  onCancel,
}: {
  profile: IcpProfile;
  verticalOptions: string[];
  onSave: (p: IcpProfile) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<IcpProfile>({ ...profile });

  const toggleInArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  return (
    <div className="space-y-3 rounded-card border border-surface-3 bg-surface-2 p-4">
      <div>
        <label className="mb-1 block text-xs text-text-tertiary">Profile Name</label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full rounded-input border border-surface-3 bg-surface-1 px-3 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-tertiary">Verticals</label>
        <div className="flex flex-wrap gap-1.5">
          {verticalOptions.map((v) => (
            <button
              key={v}
              onClick={() => setDraft({ ...draft, verticals: toggleInArray(draft.verticals, v) })}
              className={`rounded-pill border px-2 py-0.5 text-xs transition-colors ${
                draft.verticals.includes(v)
                  ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                  : "border-surface-3 text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-tertiary">Min Employees</label>
          <input
            type="number"
            value={draft.sizeMin}
            onChange={(e) => setDraft({ ...draft, sizeMin: parseInt(e.target.value) || 0 })}
            className="w-full rounded-input border border-surface-3 bg-surface-1 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-tertiary">Max Employees</label>
          <input
            type="number"
            value={draft.sizeMax}
            onChange={(e) => setDraft({ ...draft, sizeMax: parseInt(e.target.value) || 0 })}
            className="w-full rounded-input border border-surface-3 bg-surface-1 px-3 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-tertiary">Regions</label>
        <div className="flex flex-wrap gap-1.5">
          {REGION_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setDraft({ ...draft, regions: toggleInArray(draft.regions, r) })}
              className={`rounded-pill border px-2 py-0.5 text-xs transition-colors ${
                draft.regions.includes(r)
                  ? "border-accent-secondary bg-accent-secondary/10 text-accent-secondary"
                  : "border-surface-3 text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-text-tertiary">Signal Types</label>
        <div className="flex flex-wrap gap-1.5">
          {SIGNAL_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setDraft({ ...draft, signalTypes: toggleInArray(draft.signalTypes, s) })}
              className={`rounded-pill border px-2 py-0.5 text-xs capitalize transition-colors ${
                draft.signalTypes.includes(s)
                  ? "border-success bg-success/10 text-success"
                  : "border-surface-3 text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
            className="accent-accent-primary"
          />
          Set as default profile
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(draft)}
          className="rounded-input bg-accent-primary px-3 py-1 text-xs font-medium text-surface-0 transition-colors hover:bg-accent-primary/80"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-input border border-surface-3 px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function IcpProfilesSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const profiles = config.icpProfiles ?? [];
  const verticalOptions = config.verticals ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState<IcpProfile | null>(null);

  const handleSave = (profile: IcpProfile) => {
    let updated: IcpProfile[];
    if (profile.isDefault) {
      // Unset other defaults
      updated = profiles.map((p) => (p.id === profile.id ? profile : { ...p, isDefault: false }));
      if (!updated.find((p) => p.id === profile.id)) {
        updated.push(profile);
      }
    } else {
      const existing = profiles.findIndex((p) => p.id === profile.id);
      if (existing >= 0) {
        updated = [...profiles];
        updated[existing] = profile;
      } else {
        updated = [...profiles, profile];
      }
    }
    updateConfig({ icpProfiles: updated });
    setEditingId(null);
    setCreatingProfile(null);
  };

  const handleDelete = (id: string) => {
    updateConfig({ icpProfiles: profiles.filter((p) => p.id !== id) });
  };

  const handleStartCreate = () => {
    setCreatingProfile({
      id: `icp-${Date.now()}`,
      name: "",
      verticals: [],
      sizeMin: 200,
      sizeMax: 50000,
      regions: [],
      signalTypes: [],
      isDefault: false,
    });
  };

  return (
    <AdminSection
      title="ICP Profiles"
      description="Named profiles define what 'match' means for ICP scoring. The default profile auto-applies to all searches. Verticals, size range, and regions from the active profile feed into scoring."
    >
      <div className="space-y-3">
        {profiles.map((profile) =>
          editingId === profile.id ? (
            <ProfileEditor
              key={profile.id}
              profile={profile}
              verticalOptions={verticalOptions}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={profile.id}
              className="flex items-center justify-between rounded-card border border-surface-3 bg-surface-1 px-4 py-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary">{profile.name}</span>
                  {profile.isDefault && (
                    <span className="rounded-pill bg-accent-primary/10 px-1.5 py-0.5 text-xs font-medium text-accent-primary">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-text-tertiary">
                  <span>{profile.verticals.length} verticals</span>
                  <span>&middot;</span>
                  <span>{profile.sizeMin.toLocaleString()}–{profile.sizeMax.toLocaleString()} emp</span>
                  <span>&middot;</span>
                  <span>{profile.regions.length} regions</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingId(profile.id)}
                  className="text-xs text-text-tertiary hover:text-text-secondary"
                >
                  Edit
                </button>
                {!profile.isDefault && (
                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="text-xs text-danger hover:text-danger/80"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {creatingProfile ? (
          <ProfileEditor
            profile={creatingProfile}
            verticalOptions={verticalOptions}
            onSave={handleSave}
            onCancel={() => setCreatingProfile(null)}
          />
        ) : (
          <button
            onClick={handleStartCreate}
            className="w-full rounded-card border border-dashed border-surface-3 py-2 text-xs text-text-tertiary transition-colors hover:border-accent-primary hover:text-accent-primary"
          >
            + Add Profile
          </button>
        )}
      </div>
    </AdminSection>
  );
}

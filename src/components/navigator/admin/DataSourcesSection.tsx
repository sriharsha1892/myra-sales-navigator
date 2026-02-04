"use client";

import { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { CustomDataSource, DataSourceEndpoint, FieldMapping } from "@/lib/navigator/types";

export function DataSourcesSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const addToast = useStore((s) => s.addToast);
  const userName = useStore((s) => s.userName) ?? "Unknown";

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // New source form state
  const [form, setForm] = useState<Partial<CustomDataSource>>({
    name: "",
    type: "rest",
    baseUrl: "",
    authType: "api_key",
    apiKeyRef: "",
    enabled: true,
    endpoints: [],
    fieldMapping: [],
    rateLimitPerMin: 60,
    cacheTtlMinutes: 60,
  });

  const resetForm = () => {
    setForm({
      name: "", type: "rest", baseUrl: "", authType: "api_key", apiKeyRef: "",
      enabled: true, endpoints: [], fieldMapping: [], rateLimitPerMin: 60, cacheTtlMinutes: 60,
    });
  };

  const handleSave = () => {
    if (!form.name?.trim() || !form.baseUrl?.trim()) {
      addToast({ message: "Name and Base URL are required", type: "error" });
      return;
    }

    const source: CustomDataSource = {
      id: editing || `ds-${Date.now()}`,
      name: form.name!.trim(),
      type: form.type as "rest" | "graphql",
      baseUrl: form.baseUrl!.trim(),
      authType: form.authType as CustomDataSource["authType"],
      apiKeyRef: form.apiKeyRef || "",
      enabled: form.enabled ?? true,
      endpoints: form.endpoints || [],
      fieldMapping: form.fieldMapping || [],
      rateLimitPerMin: form.rateLimitPerMin || 60,
      cacheTtlMinutes: form.cacheTtlMinutes || 60,
      addedBy: userName,
      addedAt: new Date().toISOString(),
    };

    if (editing) {
      updateConfig({
        dataSources: config.dataSources.map((ds) => (ds.id === editing ? source : ds)),
      });
      addToast({ message: `Data source "${source.name}" updated`, type: "success" });
    } else {
      updateConfig({ dataSources: [...config.dataSources, source] });
      addToast({ message: `Data source "${source.name}" added`, type: "success" });
    }

    setAdding(false);
    setEditing(null);
    resetForm();
  };

  const handleEdit = (ds: CustomDataSource) => {
    setForm(ds);
    setEditing(ds.id);
    setAdding(true);
  };

  const handleDelete = (id: string) => {
    updateConfig({ dataSources: config.dataSources.filter((ds) => ds.id !== id) });
    addToast({ message: "Data source deleted", type: "success" });
  };

  const toggleEnabled = (id: string) => {
    updateConfig({
      dataSources: config.dataSources.map((ds) =>
        ds.id === id ? { ...ds, enabled: !ds.enabled } : ds
      ),
    });
  };

  // Endpoint management within the form
  const addEndpoint = () => {
    const ep: DataSourceEndpoint = {
      id: `ep-${Date.now()}`,
      name: "search",
      method: "GET",
      path: "/",
      headers: {},
      bodyTemplate: "",
    };
    setForm({ ...form, endpoints: [...(form.endpoints || []), ep] });
  };

  const updateEndpoint = (idx: number, partial: Partial<DataSourceEndpoint>) => {
    const eps = [...(form.endpoints || [])];
    eps[idx] = { ...eps[idx], ...partial };
    setForm({ ...form, endpoints: eps });
  };

  const removeEndpoint = (idx: number) => {
    setForm({ ...form, endpoints: (form.endpoints || []).filter((_, i) => i !== idx) });
  };

  // Field mapping management
  const addMapping = () => {
    const mapping: FieldMapping = { sourceField: "", targetField: "" };
    setForm({ ...form, fieldMapping: [...(form.fieldMapping || []), mapping] });
  };

  const updateMapping = (idx: number, partial: Partial<FieldMapping>) => {
    const mappings = [...(form.fieldMapping || [])];
    mappings[idx] = { ...mappings[idx], ...partial };
    setForm({ ...form, fieldMapping: mappings });
  };

  const removeMapping = (idx: number) => {
    setForm({ ...form, fieldMapping: (form.fieldMapping || []).filter((_, i) => i !== idx) });
  };

  return (
    <AdminSection title="Custom Data Sources">
      <div className="space-y-2 mb-4">
        {config.dataSources.length === 0 && !adding && (
          <p className="text-xs italic text-text-tertiary">
            No custom data sources configured. Register REST or GraphQL APIs to extend company/contact data.
          </p>
        )}
        {config.dataSources.map((ds) => (
          <div key={ds.id} className="rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleEnabled(ds.id)}
                className={`h-2 w-2 rounded-full ${ds.enabled ? "bg-success" : "bg-surface-3"}`}
                aria-label={ds.enabled ? "Enabled" : "Disabled"}
              />
              <div className="flex-1">
                <span className="text-xs font-medium text-text-primary">{ds.name}</span>
                <span className="ml-2 text-[10px] uppercase text-text-tertiary">{ds.type}</span>
              </div>
              <span className="font-mono text-[10px] text-text-tertiary">{ds.baseUrl}</span>
              <button
                onClick={() => handleEdit(ds)}
                className="text-[10px] text-text-secondary hover:text-text-primary"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(ds.id)}
                className="text-[10px] text-text-tertiary hover:text-danger"
              >
                Delete
              </button>
            </div>
            {ds.endpoints.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {ds.endpoints.map((ep) => (
                  <span key={ep.id} className="rounded-badge bg-surface-3 px-1.5 py-0.5 text-[10px] text-text-secondary">
                    {ep.method} {ep.name}
                  </span>
                ))}
              </div>
            )}
            {ds.fieldMapping.length > 0 && (
              <p className="mt-1 text-[10px] text-text-tertiary">{ds.fieldMapping.length} field mapping(s)</p>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="space-y-3 rounded-input border border-surface-3 bg-surface-2 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Source name..."
              className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "rest" | "graphql" })}
              className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="rest">REST</option>
              <option value="graphql">GraphQL</option>
            </select>
          </div>

          <input
            type="text"
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="Base URL (https://api.example.com)"
            className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          />

          <div className="flex gap-2">
            <select
              value={form.authType}
              onChange={(e) => setForm({ ...form, authType: e.target.value as CustomDataSource["authType"] })}
              className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="api_key">API Key</option>
              <option value="bearer">Bearer Token</option>
              <option value="basic">Basic Auth</option>
              <option value="none">None</option>
            </select>
            {form.authType !== "none" && (
              <select
                value={form.apiKeyRef}
                onChange={(e) => setForm({ ...form, apiKeyRef: e.target.value })}
                className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              >
                <option value="">Select API key...</option>
                {config.apiKeys.map((k) => (
                  <option key={k.id} value={k.id}>{k.label} ({k.source})</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-text-tertiary">Rate Limit/min</label>
              <input
                type="number"
                value={form.rateLimitPerMin}
                onChange={(e) => setForm({ ...form, rateLimitPerMin: parseInt(e.target.value) || 0 })}
                className="w-24 rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-text-tertiary">Cache TTL (min)</label>
              <input
                type="number"
                value={form.cacheTtlMinutes}
                onChange={(e) => setForm({ ...form, cacheTtlMinutes: parseInt(e.target.value) || 0 })}
                className="w-24 rounded-input border border-surface-3 bg-surface-2 px-2 py-1.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Endpoints */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium uppercase text-text-tertiary">Endpoints</span>
              <button onClick={addEndpoint} className="text-[10px] text-accent-primary hover:text-accent-primary/80">
                + Add Endpoint
              </button>
            </div>
            <div className="space-y-2">
              {(form.endpoints || []).map((ep, idx) => (
                <div key={ep.id} className="flex items-center gap-2 rounded border border-surface-3 bg-surface-1 px-2 py-1.5">
                  <select
                    value={ep.method}
                    onChange={(e) => updateEndpoint(idx, { method: e.target.value as "GET" | "POST" })}
                    className="rounded border border-surface-3 bg-surface-2 px-1.5 py-1 text-[10px] text-text-primary"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                  <input
                    type="text"
                    value={ep.name}
                    onChange={(e) => updateEndpoint(idx, { name: e.target.value })}
                    placeholder="Name"
                    className="w-24 rounded border border-surface-3 bg-surface-2 px-2 py-1 text-[10px] text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    value={ep.path}
                    onChange={(e) => updateEndpoint(idx, { path: e.target.value })}
                    placeholder="/path"
                    className="flex-1 rounded border border-surface-3 bg-surface-2 px-2 py-1 font-mono text-[10px] text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                  <button onClick={() => removeEndpoint(idx)} className="text-[10px] text-text-tertiary hover:text-danger">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Field Mappings */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium uppercase text-text-tertiary">Field Mappings (JSONPath)</span>
              <button onClick={addMapping} className="text-[10px] text-accent-primary hover:text-accent-primary/80">
                + Add Mapping
              </button>
            </div>
            <div className="space-y-2">
              {(form.fieldMapping || []).map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded border border-surface-3 bg-surface-1 px-2 py-1.5">
                  <input
                    type="text"
                    value={m.sourceField}
                    onChange={(e) => updateMapping(idx, { sourceField: e.target.value })}
                    placeholder="$.results[*].name"
                    className="flex-1 rounded border border-surface-3 bg-surface-2 px-2 py-1 font-mono text-[10px] text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                  <span className="text-[10px] text-text-tertiary">&rarr;</span>
                  <input
                    type="text"
                    value={m.targetField}
                    onChange={(e) => updateMapping(idx, { targetField: e.target.value })}
                    placeholder="company.name"
                    className="flex-1 rounded border border-surface-3 bg-surface-2 px-2 py-1 font-mono text-[10px] text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                  <select
                    value={m.transform || ""}
                    onChange={(e) => updateMapping(idx, { transform: (e.target.value || null) as FieldMapping["transform"] })}
                    className="rounded border border-surface-3 bg-surface-2 px-1.5 py-1 text-[10px] text-text-primary"
                  >
                    <option value="">No transform</option>
                    <option value="lowercase">lowercase</option>
                    <option value="uppercase">uppercase</option>
                    <option value="trim">trim</option>
                    <option value="parseInt">parseInt</option>
                    <option value="parseDate">parseDate</option>
                  </select>
                  <button onClick={() => removeMapping(idx)} className="text-[10px] text-text-tertiary hover:text-danger">
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse">
              {editing ? "Update Source" : "Save Source"}
            </button>
            <button
              onClick={() => { setAdding(false); setEditing(null); resetForm(); }}
              className="rounded-input border border-surface-3 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse"
        >
          Add Data Source
        </button>
      )}
    </AdminSection>
  );
}

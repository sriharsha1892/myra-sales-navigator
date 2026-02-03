"use client";

import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";
import type { ChatbotConfig } from "@/lib/types";
import { DEFAULT_CHATBOT_CONFIG } from "@/lib/types";

export function ChatbotConfigSection() {
  const adminConfig = useStore((s) => s.adminConfig);
  const updateAdminConfig = useStore((s) => s.updateAdminConfig);

  const config: ChatbotConfig =
    (adminConfig as unknown as Record<string, unknown>).chatbotConfig as ChatbotConfig | undefined
    ?? DEFAULT_CHATBOT_CONFIG;

  const update = (partial: Partial<ChatbotConfig>) => {
    (updateAdminConfig as unknown as (config: Record<string, unknown>) => void)({
      chatbotConfig: { ...config, ...partial },
    });
  };

  return (
    <>
      <AdminSection title="Chatbot Settings" description="Configure the AI chatbot assistant behavior, context, and prompts.">
        <div className="space-y-4">
          {/* Enable/disable toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              className="h-3.5 w-3.5 rounded accent-accent-primary"
            />
            <span className="text-sm text-text-primary">Enable chatbot widget</span>
          </label>

          {/* Greeting */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Greeting Message
            </label>
            <input
              type="text"
              value={config.greeting}
              onChange={(e) => update({ greeting: e.target.value })}
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Temperature ({config.temperature})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature}
              onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
              className="w-full accent-accent-primary"
            />
            <div className="flex justify-between text-[10px] text-text-tertiary">
              <span>Precise (0)</span>
              <span>Creative (1)</span>
            </div>
          </div>

          {/* Max history */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              Max History Messages
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={config.maxHistoryMessages}
              onChange={(e) => update({ maxHistoryMessages: parseInt(e.target.value) || 20 })}
              className="w-32 rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>
        </div>
      </AdminSection>

      <AdminSection title="System Prompt" description="The base personality and instructions for the chatbot. This is sent with every message.">
        <textarea
          value={config.systemPrompt}
          onChange={(e) => update({ systemPrompt: e.target.value })}
          rows={6}
          className="w-full resize-y rounded-input border border-surface-3 bg-surface-2 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
      </AdminSection>

      <AdminSection title="App Help Knowledge" description="Information about the app's features. The chatbot uses this to answer 'how do I...' questions.">
        <textarea
          value={config.appHelpContext}
          onChange={(e) => update({ appHelpContext: e.target.value })}
          rows={8}
          className="w-full resize-y rounded-input border border-surface-3 bg-surface-2 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
      </AdminSection>

      <AdminSection title="Company Analysis Prompt" description="Instructions for when a company is selected. Tells the chatbot how to analyze dossier data.">
        <textarea
          value={config.companyAnalysisPrompt}
          onChange={(e) => update({ companyAnalysisPrompt: e.target.value })}
          rows={3}
          className="w-full resize-y rounded-input border border-surface-3 bg-surface-2 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
      </AdminSection>

      <AdminSection title="Custom Instructions" description="Additional context or rules. Use this for company-specific knowledge, sales playbook tips, or any extra instructions.">
        <textarea
          value={config.customInstructions}
          onChange={(e) => update({ customInstructions: e.target.value })}
          rows={4}
          placeholder="Example: Our main competitors are X and Y. When analyzing companies, always mention if they use competitor products. Our sweet spot is companies with 200-1000 employees in the food & chemicals vertical..."
          className="w-full resize-y rounded-input border border-surface-3 bg-surface-2 px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
      </AdminSection>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface WorkflowStep {
  label: string;
  detail: string;
  isFinal?: boolean;
}

interface Scenario {
  steps: WorkflowStep[];
}

const SCENARIOS: Scenario[] = [
  {
    steps: [
      { label: "Searching specialty chemicals in DACH...", detail: "" },
      { label: "Found 18 matching companies", detail: "18 results" },
      { label: "Kerry Group · Food Ingredients", detail: "ICP 82" },
      { label: "5 decision-maker contacts found", detail: "" },
      { label: "Emails verified · 94% deliverable", detail: "" },
      { label: "Exported to clipboard", detail: "5 contacts", isFinal: true },
    ],
  },
  {
    steps: [
      { label: "Tracking APAC expansion signals...", detail: "" },
      { label: "12 companies with buying signals", detail: "12 matches" },
      { label: "Tate & Lyle · Funding round detected", detail: "ICP 88" },
      { label: "No existing relationship found", detail: "" },
      { label: "8 VP-level contacts enriched", detail: "" },
      { label: "Copied VP Sales email", detail: "", isFinal: true },
    ],
  },
  {
    steps: [
      { label: "Searching brenntag distributors...", detail: "" },
      { label: "Brenntag SE · Chemical Distribution", detail: "ICP 74" },
      { label: "Active opportunity · contacted 3d ago", detail: "" },
      { label: "4 new contacts found", detail: "" },
      { label: "3 emails verified", detail: "" },
      { label: "Added to export queue", detail: "3 contacts", isFinal: true },
    ],
  },
];

const STEP_STAGGER = 600;
const HOLD_DURATION = 1500;
const FADE_DURATION = 500;
const STEP_COUNT = 6;

interface DossierAnimationProps {
  onComplete?: () => void;
}

export function DossierAnimation({ onComplete }: DossierAnimationProps) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startScenario = useCallback(() => {
    setVisibleSteps(0);
    setIsFadingOut(false);

    // Reveal steps one by one
    for (let i = 0; i < STEP_COUNT; i++) {
      setTimeout(() => setVisibleSteps(i + 1), (i + 1) * STEP_STAGGER);
    }

    // Start fade out after all steps shown + hold
    setTimeout(() => setIsFadingOut(true), STEP_COUNT * STEP_STAGGER + HOLD_DURATION);
  }, []);

  useEffect(() => {
    startScenario();
  }, [startScenario]);

  // Advance to next scenario after fade-out, or finish
  useEffect(() => {
    if (!isFadingOut) return;

    const timer = setTimeout(() => {
      if (scenarioIndex < SCENARIOS.length - 1) {
        setScenarioIndex((prev) => prev + 1);
      } else {
        // All scenarios played — done
        setIsDone(true);
        onCompleteRef.current?.();
      }
    }, FADE_DURATION);

    return () => clearTimeout(timer);
  }, [isFadingOut, scenarioIndex]);

  // Restart animation when scenario changes (but not on initial mount — handled above)
  useEffect(() => {
    if (scenarioIndex > 0) {
      startScenario();
    }
  }, [scenarioIndex, startScenario]);

  if (isDone) {
    return <SettledRadar />;
  }

  const scenario = SCENARIOS[scenarioIndex];

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: "12%" }}>
      <div
        className="rounded-card"
        style={{
          border: "1px solid var(--color-surface-3)",
        }}
      >
        <div
          className="relative w-[380px] rounded-card p-6"
          style={{
            background: "var(--color-surface-1)",
            boxShadow: "var(--shadow-lg)",
            opacity: isFadingOut ? 0 : 1,
            transform: isFadingOut ? "translateX(30px) scale(0.96)" : "translateX(0) scale(1)",
            transition: `opacity ${FADE_DURATION}ms ease-in, transform ${FADE_DURATION}ms ease-in`,
          }}
        >
          {/* Workflow steps */}
          <div className="relative flex flex-col">
            {/* Vertical connecting line */}
            <div
              className="absolute left-[7px] top-[15px]"
              style={{
                width: "1.5px",
                background: "var(--color-surface-3)",
                height: visibleSteps > 1
                  ? `calc(${((visibleSteps - 1) / (STEP_COUNT - 1)) * 100}% - 15px)`
                  : "0",
                transition: `height ${STEP_STAGGER}ms ease-out`,
              }}
            />

            {scenario.steps.map((step, i) => {
              const isVisible = i < visibleSteps;
              const isFinal = step.isFinal;

              return (
                <div
                  key={`${scenarioIndex}-${i}`}
                  className="relative flex items-start gap-3 py-[7px]"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? "translateX(0)" : "translateX(-8px)",
                    transition: "opacity 400ms ease-out, transform 400ms ease-out",
                  }}
                >
                  {/* Indicator circle */}
                  <div
                    className="relative flex-shrink-0 mt-[3px]"
                    style={{ width: 15, height: 15 }}
                  >
                    {isFinal ? (
                      <div
                        className="w-full h-full rounded-full flex items-center justify-center"
                        style={{
                          background: "var(--color-accent-secondary)",
                          animation: isVisible ? "taskCheckIn 300ms ease-out 200ms both" : "none",
                        }}
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 9 9"
                          fill="none"
                          style={{
                            animation: isVisible ? "taskCheckIn 300ms ease-out 400ms both" : "none",
                          }}
                        >
                          <path
                            d="M1.5 4.5L3.5 6.5L7.5 2.5"
                            stroke="var(--color-text-inverse)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div
                        className="w-full h-full rounded-full"
                        style={{
                          border: "1.5px solid var(--color-surface-3)",
                          background: "var(--color-surface-1)",
                        }}
                      />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
                    <span
                      className="text-[0.75rem] text-text-primary leading-tight truncate"
                      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    >
                      {step.label}
                    </span>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {step.detail && (
                        <span
                          className="text-[0.65rem] text-text-tertiary whitespace-nowrap"
                          style={{ fontFamily: "'Geist Mono', monospace" }}
                        >
                          {step.detail}{isFinal ? " \u2713" : ""}
                        </span>
                      )}
                      {isFinal && !step.detail && (
                        <span
                          className="text-[0.65rem] text-accent-secondary"
                          style={{ fontFamily: "'Geist Mono', monospace" }}
                        >
                          {"\u2713"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Settled state — radar constellation (no branding, that's the right pane)
// ─────────────────────────────────────────────────────────

interface RadarNode {
  label: string;
  x: number; // % from center
  y: number; // % from center
  ring: 1 | 2 | 3; // which orbit ring
  type: "company" | "signal" | "metric";
  delay: number; // stagger delay in ms
}

const RADAR_NODES: RadarNode[] = [
  // Ring 1 (inner ~22%)
  { label: "Kerry Group", x: 15, y: -16, ring: 1, type: "company", delay: 600 },
  { label: "ICP 82", x: -18, y: 10, ring: 1, type: "metric", delay: 900 },
  { label: "hiring", x: 8, y: 18, ring: 1, type: "signal", delay: 1200 },
  // Ring 2 (mid ~38%)
  { label: "Brenntag SE", x: -30, y: -22, ring: 2, type: "company", delay: 800 },
  { label: "APAC expansion", x: 32, y: 8, ring: 2, type: "signal", delay: 1100 },
  { label: "Tate & Lyle", x: -10, y: -35, ring: 2, type: "company", delay: 1400 },
  { label: "$4.2B", x: 28, y: -28, ring: 2, type: "metric", delay: 1000 },
  // Ring 3 (outer ~55%)
  { label: "DACH", x: -45, y: 5, ring: 3, type: "signal", delay: 700 },
  { label: "funding", x: 42, y: 30, ring: 3, type: "signal", delay: 1300 },
  { label: "Dow Chemical", x: -20, y: 45, ring: 3, type: "company", delay: 1500 },
  { label: "18 results", x: 48, y: -15, ring: 3, type: "metric", delay: 1600 },
  { label: "series B", x: -42, y: -35, ring: 3, type: "signal", delay: 1100 },
];

// Lines between nodes (index pairs)
const RADAR_CONNECTIONS: [number, number][] = [
  [0, 3], // Kerry → Brenntag
  [0, 1], // Kerry → ICP 82
  [2, 4], // hiring → APAC expansion
  [3, 7], // Brenntag → DACH
  [5, 6], // Tate & Lyle → $4.2B
  [4, 8], // APAC → funding
  [9, 2], // Dow → hiring
];

function SettledRadar() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ animation: "fadeIn 600ms ease-out 200ms both" }}
    >
      {/* ── Radar container (centered) ── */}
      <div
        className="absolute"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "420px",
          height: "420px",
        }}
      >
        {/* ── Concentric rings ── */}
        {[90, 160, 230].map((r, i) => (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: r * 2,
              height: r * 2,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              border: `1px solid var(--color-surface-3)`,
              opacity: 0.5 - i * 0.1,
              animation: `fadeIn 800ms ease-out ${300 + i * 200}ms both`,
            }}
          />
        ))}

        {/* ── Connection lines (SVG) ── */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 420 420"
        >
          {RADAR_CONNECTIONS.map(([a, b], i) => {
            const na = RADAR_NODES[a];
            const nb = RADAR_NODES[b];
            const ax = 210 + (na.x / 100) * 420;
            const ay = 210 + (na.y / 100) * 420;
            const bx = 210 + (nb.x / 100) * 420;
            const by = 210 + (nb.y / 100) * 420;
            return (
              <line
                key={i}
                x1={ax} y1={ay} x2={bx} y2={by}
                stroke="var(--color-surface-3)"
                strokeWidth="0.75"
                opacity="0.4"
              />
            );
          })}
        </svg>

        {/* ── Center dot ── */}
        <div
          className="absolute"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--color-accent-secondary)",
          }}
        />

        {/* ── Data nodes ── */}
        {RADAR_NODES.map((node, i) => {
          const px = 210 + (node.x / 100) * 420;
          const py = 210 + (node.y / 100) * 420;
          const isCompany = node.type === "company";
          const isMetric = node.type === "metric";

          return (
            <div
              key={i}
              className="absolute flex items-center gap-1.5"
              style={{
                left: px,
                top: py,
                transform: "translate(-50%, -50%)",
                animation: `fadeIn 500ms ease-out ${node.delay}ms both`,
              }}
            >
              {/* Node dot */}
              <div
                style={{
                  width: isCompany ? "5px" : "3.5px",
                  height: isCompany ? "5px" : "3.5px",
                  borderRadius: "50%",
                  background: isCompany
                    ? "var(--color-accent-secondary)"
                    : isMetric
                      ? "var(--color-accent-highlight)"
                      : "var(--color-surface-3)",
                }}
              />
              {/* Label */}
              <span
                className="select-none whitespace-nowrap"
                style={{
                  fontFamily: isMetric
                    ? "'Geist Mono', monospace"
                    : "'Plus Jakarta Sans', sans-serif",
                  fontSize: isCompany ? "0.62rem" : "0.55rem",
                  fontWeight: isCompany ? 500 : 400,
                  color: isCompany ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
                  opacity: isCompany ? 0.7 : 0.5,
                }}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Bottom status line ── */}
      <div
        className="absolute bottom-[12%] left-0 right-0 flex justify-center"
        style={{ animation: "fadeIn 600ms ease-out 2000ms both" }}
      >
        <div className="flex items-center gap-2">
          <div
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: "var(--color-accent-highlight)",
              animation: "pulse-subtle 2s ease-in-out infinite",
            }}
          />
          <span
            className="select-none"
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: "0.58rem",
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.04em",
            }}
          >
            3 workflows complete · ready
          </span>
        </div>
      </div>
    </div>
  );
}

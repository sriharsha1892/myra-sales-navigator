"use client";

import { useState, useEffect } from "react";

export function RevenueSequence() {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ opacity: 0.18, filter: "blur(0.5px)", zIndex: 0 }}
    >
      <div key={cycle} className="relative w-[600px]" style={{ fontFamily: "'Geist Mono', monospace" }}>
        {/* Phase 1: SEARCH — query types in */}
        <div
          className="absolute left-0"
          style={{ top: 0, animation: "revealFade 0.4s ease-out 0s both, revealReset 0.4s ease-out 3.2s both" }}
        >
          <span className="text-[11px] uppercase tracking-[0.1em] text-[#f0f0f5]/60">Search</span>
          <div
            className="mt-1 overflow-hidden whitespace-nowrap text-[13px] text-[#f0f0f5]"
            style={{ animation: "revealType 0.5s steps(40,end) 0.1s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            food ingredients expanding Asia
          </div>
        </div>

        {/* Phase 2: DISCOVER — 3 company rows fade in with ICP rings */}
        <div style={{ position: "absolute", top: 50, left: 0, right: 0 }}>
          <span
            className="text-[11px] uppercase tracking-[0.1em] text-[#f0f0f5]/60"
            style={{ animation: "revealFade 0.3s ease-out 0.6s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            Discover
          </span>

          {/* Row 1 */}
          <div
            className="mt-2 flex items-center gap-3"
            style={{ animation: "revealFade 0.3s ease-out 0.7s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
              <circle cx="10" cy="10" r="8" fill="none" stroke="#f0f0f5" strokeWidth="1.5"
                strokeDasharray="50.27" strokeDashoffset="50.27"
                style={{ animation: "icpRingDraw 0.6s ease-out 0.8s both, revealReset 0.4s ease-out 3.2s both" }}
              />
            </svg>
            <span className="text-[12px] text-[#f0f0f5]">Tate &amp; Lyle</span>
            <span className="text-[10px] text-[#f0f0f5]/40">Food Ingredients</span>
            <span className="text-[10px] text-[#f0f0f5]/60">ICP 82</span>
          </div>

          {/* Row 2 */}
          <div
            className="mt-1.5 flex items-center gap-3"
            style={{ animation: "revealFade 0.3s ease-out 0.9s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
              <circle cx="10" cy="10" r="8" fill="none" stroke="#f0f0f5" strokeWidth="1.5"
                strokeDasharray="50.27" strokeDashoffset="50.27"
                style={{ animation: "icpRingDraw 0.6s ease-out 1.0s both, revealReset 0.4s ease-out 3.2s both" }}
              />
            </svg>
            <span className="text-[12px] text-[#f0f0f5]">Brenntag SE</span>
            <span className="text-[10px] text-[#f0f0f5]/40">Chemicals</span>
            <span className="text-[10px] text-[#f0f0f5]/60">ICP 74</span>
          </div>

          {/* Row 3 */}
          <div
            className="mt-1.5 flex items-center gap-3"
            style={{ animation: "revealFade 0.3s ease-out 1.1s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
              <circle cx="10" cy="10" r="8" fill="none" stroke="#f0f0f5" strokeWidth="1.5"
                strokeDasharray="50.27" strokeDashoffset="50.27"
                style={{ animation: "icpRingDraw 0.6s ease-out 1.2s both, revealReset 0.4s ease-out 3.2s both" }}
              />
            </svg>
            <span className="text-[12px] text-[#f0f0f5]">Kerry Group</span>
            <span className="text-[10px] text-[#f0f0f5]/40">Food Tech</span>
            <span className="text-[10px] text-[#f0f0f5]/60">ICP 68</span>
          </div>
        </div>

        {/* Phase 3: QUALIFY — first row highlights ember, contact lines */}
        <div style={{ position: "absolute", top: 180, left: 0, right: 0 }}>
          <span
            className="text-[11px] uppercase tracking-[0.1em] text-[#f0f0f5]/60"
            style={{ animation: "revealFade 0.3s ease-out 1.4s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            Qualify
          </span>
          <div
            className="mt-2 rounded border px-3 py-1.5"
            style={{
              borderColor: "transparent",
              animation: "revealHighlight 0.4s ease-out 1.5s both, revealReset 0.4s ease-out 3.2s both",
            }}
          >
            <span className="text-[12px] text-[#f0f0f5]">Tate &amp; Lyle</span>
            <span className="ml-2 text-[10px] text-[#c9a227]">82</span>
          </div>
          <div
            className="mt-1 pl-4 text-[11px] text-[#f0f0f5]/50"
            style={{ animation: "revealFade 0.3s ease-out 1.7s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            J. Chen · VP Procurement · j.chen@tateandlyle.com
          </div>
          <div
            className="mt-0.5 pl-4 text-[11px] text-[#f0f0f5]/50"
            style={{ animation: "revealFade 0.3s ease-out 1.85s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            M. Kumar · Dir. Sourcing · m.kumar@tateandlyle.com
          </div>
        </div>

        {/* Phase 4: DRAFT — email subject types, body sketches */}
        <div style={{ position: "absolute", top: 300, left: 0, right: 0 }}>
          <span
            className="text-[11px] uppercase tracking-[0.1em] text-[#f0f0f5]/60"
            style={{ animation: "revealFade 0.3s ease-out 2.0s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            Draft
          </span>
          <div
            className="mt-2 overflow-hidden whitespace-nowrap text-[12px] text-[#f0f0f5]"
            style={{ animation: "revealType 0.5s steps(50,end) 2.1s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            Re: APAC expansion — ingredient sourcing partnership
          </div>
          <div
            className="mt-1.5 text-[11px] text-[#f0f0f5]/30"
            style={{ animation: "revealFade 0.3s ease-out 2.3s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            Hi Jing, saw Tate &amp; Lyle&apos;s APAC expansion news...
          </div>
          <div
            className="mt-0.5 text-[11px] text-[#f0f0f5]/20"
            style={{ animation: "revealFade 0.3s ease-out 2.45s both, revealReset 0.4s ease-out 3.2s both" }}
          >
            We help mid-size food ingredient companies streamline...
          </div>
        </div>

        {/* Phase 5: SHIP — sent stamp */}
        <div style={{ position: "absolute", top: 400, left: 0 }}>
          <div
            className="inline-flex items-center gap-2 rounded border border-[#f0f0f5]/10 px-3 py-1.5"
            style={{
              animation: "revealStamp 0.3s ease-out 2.6s both, revealReset 0.4s ease-out 3.2s both",
            }}
          >
            <span className="text-[12px] text-[#f0f0f5]/70">&#10003; Sent</span>
          </div>
        </div>
      </div>
    </div>
  );
}

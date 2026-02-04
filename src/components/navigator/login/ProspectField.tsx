"use client";

interface Fragment {
  text: string;
  x: number;
  y: number;
  rot: number;
  layer: 1 | 2 | 3;
}

const FRAGMENTS: Fragment[] = [
  // Domains
  { text: "kerrygroup.com", x: 5, y: 8, rot: -3, layer: 2 },
  { text: "brenntag.com", x: 72, y: 15, rot: 7, layer: 1 },
  { text: "dow.com", x: 38, y: 82, rot: -8, layer: 3 },
  { text: "tateandlyle.com", x: 85, y: 55, rot: 4, layer: 2 },
  { text: "ajinomoto.com", x: 15, y: 68, rot: -12, layer: 1 },
  { text: "basf.com", x: 60, y: 92, rot: 6, layer: 2 },
  { text: "dsm.com", x: 92, y: 30, rot: -5, layer: 3 },
  // Numbers
  { text: "22K", x: 25, y: 22, rot: 11, layer: 1 },
  { text: "88", x: 78, y: 72, rot: -6, layer: 3 },
  { text: "74", x: 48, y: 38, rot: 9, layer: 2 },
  { text: "$4.2B", x: 10, y: 45, rot: -14, layer: 1 },
  { text: "1,200", x: 65, y: 5, rot: 3, layer: 2 },
  { text: "$890M", x: 33, y: 92, rot: -7, layer: 3 },
  { text: "46K", x: 88, y: 82, rot: 12, layer: 1 },
  { text: "92", x: 55, y: 28, rot: -4, layer: 2 },
  { text: "3,400", x: 18, y: 88, rot: 8, layer: 3 },
  // Abbreviations
  { text: "APAC", x: 42, y: 12, rot: -10, layer: 2 },
  { text: "LATAM", x: 80, y: 42, rot: 5, layer: 1 },
  { text: "EMEA", x: 8, y: 32, rot: -2, layer: 3 },
  { text: "VP", x: 55, y: 65, rot: 13, layer: 2 },
  { text: "ICP", x: 30, y: 55, rot: -8, layer: 1 },
  { text: "CTO", x: 70, y: 88, rot: 6, layer: 3 },
  { text: "CFO", x: 95, y: 12, rot: -11, layer: 2 },
  { text: "DACH", x: 22, y: 78, rot: 4, layer: 1 },
  // Keywords
  { text: "expansion", x: 62, y: 48, rot: -5, layer: 3 },
  { text: "hiring", x: 15, y: 18, rot: 9, layer: 2 },
  { text: "sourcing", x: 82, y: 25, rot: -13, layer: 1 },
  { text: "funding", x: 45, y: 72, rot: 7, layer: 3 },
  { text: "acquisition", x: 28, y: 42, rot: -3, layer: 2 },
  { text: "partnership", x: 75, y: 62, rot: 10, layer: 1 },
  { text: "revenue", x: 50, y: 5, rot: -9, layer: 2 },
  { text: "growth", x: 8, y: 58, rot: 6, layer: 3 },
  { text: "series B", x: 68, y: 35, rot: -7, layer: 1 },
  { text: "IPO", x: 35, y: 25, rot: 15, layer: 2 },
  { text: "M&A", x: 90, y: 68, rot: -4, layer: 3 },
  { text: "R&D", x: 42, y: 58, rot: 8, layer: 1 },
  { text: "supply chain", x: 12, y: 95, rot: -6, layer: 2 },
  { text: "distributor", x: 58, y: 18, rot: 11, layer: 3 },
  { text: "ingredients", x: 78, y: 8, rot: -10, layer: 1 },
  { text: "chemicals", x: 25, y: 65, rot: 3, layer: 2 },
  { text: "amino acids", x: 52, y: 88, rot: -12, layer: 3 },
  { text: "flavors", x: 88, y: 48, rot: 7, layer: 1 },
  { text: "specialty", x: 5, y: 82, rot: -1, layer: 2 },
  { text: "B2B", x: 68, y: 78, rot: 14, layer: 3 },
  { text: "enterprise", x: 38, y: 48, rot: -5, layer: 1 },
];

// Connection line pairs (indices into FRAGMENTS — domain↔keyword related pairs)
const CONNECTION_PAIRS: [number, number][] = [
  [0, 25],  // kerrygroup ↔ hiring
  [1, 30],  // brenntag ↔ revenue
  [2, 31],  // dow ↔ growth
  [3, 24],  // tateandlyle ↔ expansion
  [4, 41],  // ajinomoto ↔ amino acids
  [5, 40],  // basf ↔ chemicals
];

const LAYER_CONFIG = {
  1: { size: 7, opacity: 0.15, animation: "fragmentDriftSlow 40s ease-in-out infinite" },
  2: { size: 9, opacity: 0.25, animation: "fragmentDriftMedium 30s ease-in-out infinite" },
  3: { size: 11, opacity: 0.40, animation: "none" },
} as const;

// Center of left panel where dossier sits (roughly)
const CENTER_X = 50;
const CENTER_Y = 44;
const PROXIMITY_RADIUS = 30;

function getProximityBoost(x: number, y: number): { opacity: number; shadow: string } {
  const dist = Math.hypot(x - CENTER_X, y - CENTER_Y);
  if (dist < PROXIMITY_RADIUS) {
    const factor = 1 - dist / PROXIMITY_RADIUS;
    return {
      opacity: factor * 0.15,
      shadow: `0 0 ${4 * factor}px rgba(143,217,196,${0.3 * factor})`,
    };
  }
  return { opacity: 0, shadow: "none" };
}

interface ProspectFieldProps {
  settled?: boolean;
}

export function ProspectField({ settled = false }: ProspectFieldProps) {
  return (
    <div className="absolute inset-0 overflow-hidden prospect-dot-grid">
      {/* Aurora mesh gradients */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "500px",
          height: "500px",
          left: "10%",
          top: "15%",
          background: `radial-gradient(ellipse at center, rgba(143,217,196,${settled ? 0.08 : 0.06}), transparent 70%)`,
          animation: "auroraDrift1 20s ease-in-out infinite",
          transition: "opacity 1s",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: "450px",
          height: "450px",
          right: "5%",
          bottom: "10%",
          background: `radial-gradient(ellipse at center, rgba(27,77,62,${settled ? 0.07 : 0.05}), transparent 70%)`,
          animation: "auroraDrift2 25s ease-in-out infinite",
          transition: "opacity 1s",
        }}
      />

      {/* Data fragments with depth layers */}
      {FRAGMENTS.map((f, i) => {
        const config = LAYER_CONFIG[f.layer];
        const proximity = getProximityBoost(f.x, f.y);
        const finalOpacity = config.opacity + proximity.opacity;

        return (
          <span
            key={i}
            className="absolute select-none whitespace-nowrap"
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              transform: `rotate(${f.rot}deg)`,
              fontFamily: "'Geist Mono', monospace",
              fontSize: `${config.size}px`,
              color: "#D5D3CD",
              opacity: finalOpacity,
              lineHeight: 1,
              textShadow: proximity.shadow,
              animation: config.animation,
            }}
          >
            {f.text}
          </span>
        );
      })}

      {/* Connection lines SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        {CONNECTION_PAIRS.map(([a, b], i) => {
          const fa = FRAGMENTS[a];
          const fb = FRAGMENTS[b];
          return (
            <line
              key={i}
              x1={`${fa.x}%`}
              y1={`${fa.y}%`}
              x2={`${fb.x}%`}
              y2={`${fb.y}%`}
              stroke="rgba(143,217,196,0.15)"
              strokeWidth="0.5"
              strokeDasharray="200"
              strokeDashoffset="200"
              style={{
                animation: `lineTrace 3s ease-out ${i * 0.5}s both`,
              }}
            />
          );
        })}
      </svg>

      {/* Horizontal luminous sweep (original) */}
      <div
        className="absolute inset-y-0 pointer-events-none"
        style={{
          width: "100%",
          background:
            "radial-gradient(ellipse 300px 600px at center, rgba(143,217,196,0.12), transparent 70%)",
          animation: `prospectSweep ${settled ? "20s" : "12s"} linear infinite`,
        }}
      />

      {/* Vertical luminous sweep */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          height: "100%",
          background:
            "radial-gradient(ellipse 600px 200px at center, rgba(27,77,62,0.08), transparent 70%)",
          animation: `prospectSweepVertical ${settled ? "24s" : "16s"} linear infinite`,
        }}
      />
    </div>
  );
}

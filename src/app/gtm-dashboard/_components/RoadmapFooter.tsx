"use client";

import { useRoadmapTiles } from "@/hooks/useGtmDashboardData";

export function RoadmapFooter() {
  const { data: tiles } = useRoadmapTiles();

  if (!tiles || tiles.length === 0) return null;

  return (
    <div className="border-t border-gray-200/60 bg-white/40 px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider shrink-0">
          Coming up
        </span>
        <div className="flex gap-3 overflow-x-auto">
          {tiles.map((tile, i) => (
            <div
              key={i}
              className="shrink-0 bg-white rounded-lg border border-gray-200/80 px-3 py-2 max-w-[200px]"
            >
              <p className="text-xs font-medium text-gray-800 truncate">
                {tile.title}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {tile.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

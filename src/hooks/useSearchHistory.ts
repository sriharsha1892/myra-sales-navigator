"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import type { SearchHistoryEntry, FilterState } from "@/lib/types";

async function fetchHistory(userName: string | null): Promise<SearchHistoryEntry[]> {
  const params = userName ? `?user=${encodeURIComponent(userName)}` : "";
  const res = await fetch(`/api/search/history${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.history ?? [];
}

interface SaveParams {
  userName: string;
  label: string;
  filters: FilterState | Record<string, never>;
  resultCount: number;
}

async function postHistory(params: SaveParams): Promise<SearchHistoryEntry> {
  const res = await fetch("/api/search/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return data.entry;
}

export function useSearchHistory() {
  const userName = useStore((s) => s.userName);
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["search-history", userName],
    queryFn: () => fetchHistory(userName),
    enabled: !!userName,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: postHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-history", userName] });
    },
  });

  const saveToHistory = (label: string, filters: FilterState | Record<string, never>, resultCount: number) => {
    if (!userName) return;
    // Dedup: skip if label matches most recent entry
    if (history.length > 0 && history[0].label === label) return;

    mutation.mutate({ userName, label, filters, resultCount });
  };

  return { history, isLoading, saveToHistory };
}

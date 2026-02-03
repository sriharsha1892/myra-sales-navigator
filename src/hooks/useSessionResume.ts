"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";

interface SessionResumeData {
  recentCompanies: {
    domain: string;
    name: string;
    status: string;
    last_viewed_at: string;
  }[];
  recentSearches: {
    id: string;
    label: string | null;
    filters: Record<string, unknown>;
    resultCount: number;
    timestamp: string;
  }[];
  inProgress: {
    domain: string;
    name: string;
    status: string;
    status_changed_at: string;
  }[];
}

export function useSessionResume() {
  const { userName } = useAuth();

  const query = useQuery<SessionResumeData>({
    queryKey: ["session-resume", userName],
    queryFn: async () => {
      const res = await fetch(`/api/session/resume?user=${encodeURIComponent(userName ?? "")}`);
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
    enabled: !!userName,
    staleTime: 5 * 60 * 1000,
  });

  return {
    recentCompanies: query.data?.recentCompanies ?? [],
    recentSearches: query.data?.recentSearches ?? [],
    inProgress: query.data?.inProgress ?? [],
    isLoading: query.isLoading,
  };
}

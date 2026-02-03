"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useStore } from "@/lib/store";
import { pick } from "@/lib/ui-copy";

interface UnreadMention {
  noteId: string;
  companyDomain: string;
  content: string;
  authorName: string;
  createdAt: string;
}

interface AuthContextValue {
  userName: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
  lastLoginAt: string | null;
  unreadMentions: UnreadMention[];
  clearMentions: () => void;
  login: (name: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  userName: null,
  isAdmin: false,
  isLoading: true,
  sessionExpired: false,
  lastLoginAt: null,
  unreadMentions: [],
  clearMentions: () => {},
  login: () => {},
  logout: () => {},
});

const ME_RETRY_ATTEMPTS = 3;
const ME_RETRY_DELAY = 2000;

async function fetchMe(attempt = 0): Promise<Response> {
  try {
    const res = await fetch("/api/auth/me");
    return res;
  } catch (err) {
    // Network error — retry
    if (attempt < ME_RETRY_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, ME_RETRY_DELAY));
      return fetchMe(attempt + 1);
    }
    throw err;
  }
}

function getISTGreeting(name: string, lastLoginAt: string | null): string {
  // First-time login
  if (!lastLoginAt) {
    const firstTimeVariants = [
      `Welcome to myRA, ${name}`,
      `Hey ${name} — welcome aboard`,
      `${name}, let's find some prospects`,
    ];
    return firstTimeVariants[Math.floor(Math.random() * firstTimeVariants.length)];
  }

  // IST = UTC + 5:30
  const now = new Date();
  const istHour = (now.getUTCHours() + 5 + (now.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;

  if (istHour >= 5 && istHour < 12) {
    const v = [`Good morning, ${name}`, `Morning, ${name} — ready to prospect?`, `Rise and grind, ${name}`];
    return v[Math.floor(Math.random() * v.length)];
  }
  if (istHour >= 12 && istHour < 17) {
    const v = [`Good afternoon, ${name}`, `Back at it, ${name}?`, `Afternoon, ${name}`];
    return v[Math.floor(Math.random() * v.length)];
  }
  if (istHour >= 17 && istHour < 21) {
    const v = [`Good evening, ${name}`, `Evening session, ${name}?`, `Still going strong, ${name}`];
    return v[Math.floor(Math.random() * v.length)];
  }
  const v = [`Burning the midnight oil, ${name}?`, `Late night hustle, ${name}`, `${name}, the night shift begins`];
  return v[Math.floor(Math.random() * v.length)];
}

function hasJustLoggedInCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((row) => row.startsWith("myra_just_logged_in="));
}

function clearJustLoggedInCookie() {
  document.cookie = "myra_just_logged_in=; path=/; max-age=0";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUserName, addToast } = useStore();
  const userName = useStore((s) => s.userName);
  const isAdmin = useStore((s) => s.isAdmin);

  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [unreadMentions, setUnreadMentions] = useState<UnreadMention[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetchMe();

        if (cancelled) return;

        if (res.status === 401) {
          // Session expired — redirect to password login (skip if already there)
          setUserName(null);
          setIsLoading(false);
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          return;
        }

        if (!res.ok) {
          // Unexpected server error — treat as network issue
          addToast({ message: "Connection issue — retrying", type: "warning", dedupKey: "auth-network" });
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        setUserName(data.name, data.isAdmin ?? false);
        setLastLoginAt(data.lastLoginAt);
        setUnreadMentions(data.unreadMentions ?? []);
        setSessionExpired(false);

        // Welcome toast on fresh login
        if (hasJustLoggedInCookie()) {
          clearJustLoggedInCookie();
          const greeting = getISTGreeting(data.name, data.lastLoginAt);
          addToast({ message: greeting, type: "info", duration: 4000 });
        }
      } catch {
        // Network failure after retries
        if (!cancelled) {
          addToast({ message: "Connection issue — check your network", type: "error", dedupKey: "auth-network" });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    (name: string) => {
      setUserName(name);
      setSessionExpired(false);
    },
    [setUserName]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort — redirect anyway
    }
    setUserName(null);
    setSessionExpired(false);
    window.location.href = "/login";
  }, [setUserName]);

  const clearMentions = useCallback(async () => {
    setUnreadMentions([]);
    try {
      await fetch("/api/auth/mentions/read", { method: "POST" });
    } catch {
      // Best-effort — UI already cleared
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        userName,
        isAdmin,
        isLoading,
        sessionExpired,
        lastLoginAt,
        unreadMentions,
        clearMentions,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

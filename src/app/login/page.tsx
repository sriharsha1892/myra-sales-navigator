"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const TEAM_NAMES = [
  "SriHarsha",
  "Adi",
  "JVS",
  "Reddy",
  "Sai",
  "Satish",
  "Sudeshana",
  "Kirandeep",
  "Nikita",
  "Asim",
  "Satyananth",
  "Aditya Prasad",
  "Vijay Ravi",
];

function getSavedName(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/myra_last_name=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(getSavedName());
  }, []);

  const handleLogin = async () => {
    if (!name || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: password.trim() }),
      });
      if (res.ok) {
        // Remember name for next time + mark fresh login for welcome toast
        document.cookie = `myra_last_name=${encodeURIComponent(name)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        document.cookie = "myra_just_logged_in=1; path=/; max-age=30; SameSite=Lax";
        // Full reload so AuthProvider re-fetches /api/auth/me with fresh session cookie
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error || "Login failed.");
      }
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-0 via-surface-0 to-surface-2">
      <div className="w-full max-w-sm rounded-card border border-surface-3 bg-surface-1 p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1
            className="font-display text-2xl text-text-primary"
            style={{ animation: "blurToSharp 600ms ease-out both" }}
          >
            myRA
          </h1>
          <p className="mt-1 text-sm text-text-tertiary">Sales Navigator</p>
        </div>

        {error && (
          <p className="mb-4 text-center text-xs text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Who are you?
            </label>
            <select
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="">Select your name</option>
              {TEAM_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Team password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              placeholder="Enter team password"
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading || !name || !password.trim()}
            className="w-full rounded-input bg-accent-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";

function getSavedEmail(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/myra_email=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function SessionExpiryOverlay() {
  const { sessionExpired } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Pre-fill email from saved cookie + fade-in animation
  useEffect(() => {
    if (sessionExpired) {
      setEmail(getSavedEmail());
      // Trigger fade-in on next frame
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
    }
  }, [sessionExpired]);

  if (!sessionExpired) return null;

  const handleRequest = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.ok) {
        setSubmitted(true);
        document.cookie = `myra_email=${encodeURIComponent(email.trim().toLowerCase())}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      } else {
        const data = await res.json();
        setError(data.error || "Request failed");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-surface-0/60 backdrop-blur-sm transition-opacity duration-180 ease-out ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`w-full max-w-sm rounded-card border border-surface-3 bg-surface-1 p-8 shadow-lg transition-all duration-180 ease-out ${
          mounted ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
        }`}
      >
        <div className="mb-6 text-center">
          <h2 id="session-expired-title" className="font-display text-xl text-text-primary">
            Session Expired
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Your session has ended. Request a new login link to continue.
          </p>
        </div>

        {submitted ? (
          <div className="text-center">
            <p className="text-sm text-accent-secondary">
              Request sent. Your admin will send you a new login link.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRequest(); }}
              placeholder="Your email address"
              aria-label="Email address"
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
            {error && (
              <p className="text-xs text-danger" role="alert">{error}</p>
            )}
            <button
              onClick={handleRequest}
              disabled={loading || !email.trim()}
              className="w-full rounded-input bg-accent-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Requesting..." : "Request Access"}
            </button>
            <button
              onClick={() => { window.location.href = "/login"; }}
              className="w-full rounded-input border border-surface-3 px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

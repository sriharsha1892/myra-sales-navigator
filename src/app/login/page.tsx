"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function getReturnToCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/myra_return_to=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getSavedEmail(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/myra_email=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [curtainUp, setCurtainUp] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "expired") {
      setError("Your login link has expired. Request a new one below.");
    } else if (err === "missing_token") {
      setError("Invalid login link. Request a new one below.");
    } else if (err === "not_found") {
      setError("Your account was not found. Contact your admin.");
    }

    setReturnTo(getReturnToCookie());
    setEmail(getSavedEmail());
  }, [searchParams]);

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
        // Curtain-up animation on success
        setTimeout(() => setCurtainUp(true), 300);
      } else {
        const data = await res.json();
        setError(data.error || "Request failed. Try again.");
      }
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`w-full max-w-sm rounded-card border border-surface-3 bg-surface-1 p-8 shadow-lg${curtainUp ? " animate-[curtainUp_500ms_ease-in-out_forwards]" : ""}`}
    >
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl text-text-primary" style={{ animation: "blurToSharp 600ms ease-out both" }}>
          myRA
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">Sales Navigator</p>
      </div>

      {error && (
        <p className="mb-4 text-center text-xs text-danger" role="alert">{error}</p>
      )}

      {returnTo && (
        <p className="mb-4 text-center text-xs text-text-tertiary">
          You&apos;ll be returned to <span className="font-mono text-accent-secondary">{returnTo}</span>
        </p>
      )}

      {submitted ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-accent-secondary">
            Request sent. Your admin will send you a login link.
          </p>
          <p className="text-xs text-text-tertiary">
            Check with your team admin for the link.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 text-center">
            <p className="text-sm text-text-secondary">
              Enter your email to request a login link.
            </p>
          </div>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRequest(); }}
            placeholder="Your email address"
            aria-label="Email address"
            className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          />

          <button
            onClick={handleRequest}
            disabled={loading || !email.trim()}
            className="w-full rounded-input bg-accent-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
          >
            {loading ? "Requesting..." : "Request Access"}
          </button>

          <p className="text-center text-xs text-text-tertiary">
            Login links expire after a short time.
          </p>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-0 via-surface-0 to-surface-2">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-card border border-surface-3 bg-surface-1 p-8 shadow-lg">
            <div className="mb-6 text-center">
              <h1 className="font-display text-2xl text-text-primary">myRA</h1>
              <p className="mt-1 text-sm text-text-tertiary">Sales Navigator</p>
            </div>
            <div className="shimmer mx-auto h-10 w-full rounded-input" />
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  );
}

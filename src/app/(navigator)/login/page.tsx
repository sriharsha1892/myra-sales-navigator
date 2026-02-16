"use client";

import { useState, useEffect, useRef } from "react";
import { pick } from "@/lib/navigator/ui-copy";
import { DossierAnimation } from "@/components/navigator/login/DossierAnimation";
import { ProspectField } from "@/components/navigator/login/ProspectField";

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
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [cardFocused, setCardFocused] = useState(false);
  const [dossierDone, setDossierDone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(getSavedName());
  }, []);

  // Auto-focus the right input after dossier invite pulse
  useEffect(() => {
    if (dossierDone && cardRef.current) {
      const target = name
        ? cardRef.current.querySelector<HTMLElement>('input[type="password"]')
        : cardRef.current.querySelector<HTMLElement>("select");
      target?.focus();
    }
  }, [dossierDone, name]);

  const handleLogin = async () => {
    if (!name) {
      setError(pick("login_pick_name"));
      return;
    }
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password: password.trim() }),
      });
      if (res.ok) {
        document.cookie = `myra_last_name=${encodeURIComponent(name)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        document.cookie = "myra_just_logged_in=1; path=/; max-age=30; SameSite=Lax";
        setLoginSuccess(true);
        setTimeout(() => {
          window.location.href = "/";
        }, 1200);
      } else {
        const data = await res.json();
        if (data.error?.toLowerCase().includes("password")) {
          setError(pick("login_wrong_password"));
        } else {
          setError(data.error || "Login failed.");
        }
      }
    } catch {
      setError(pick("network_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCardFocus = () => { setCardFocused(true); setDossierDone(false); };
  const handleCardBlur = (e: React.FocusEvent) => {
    if (cardRef.current && !cardRef.current.contains(e.relatedTarget as Node)) {
      setCardFocused(false);
    }
  };

  const isDisabled = loading || !name || !password.trim();

  return (
    <div className="flex min-h-screen bg-surface-0">
      {/* Left panel — Prospect Field + Dossier Animation */}
      <div className="relative w-[55%] overflow-hidden">
        <ProspectField settled={dossierDone} />
        <DossierAnimation onComplete={() => setDossierDone(true)} />
      </div>

      {/* Right panel — Branding + Login */}
      <div className="flex w-[45%] flex-col items-center justify-center panel-divider login-right-dot-grid relative bg-surface-1">
        {/* Branding */}
        <div className="relative flex flex-col items-center">
          <h1
            className="relative text-[2.5rem] text-text-primary"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              zIndex: 1,
            }}
          >
            myRA
          </h1>
          <p
            className="relative mt-1 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-accent-secondary"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              zIndex: 1,
            }}
          >
            Sales Navigator
          </p>
          <p
            className="relative mt-2 text-[0.75rem] italic text-text-tertiary"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              zIndex: 1,
            }}
          >
            From signal to contact in seconds.
          </p>
        </div>

        {/* Login card */}
        <div
          className="mt-8 w-full max-w-[380px]"
          style={{
            padding: cardFocused || dossierDone ? "1.5px" : "0",
            borderRadius: "var(--radius-card)",
            border: cardFocused || dossierDone ? "none" : "1px solid transparent",
            background: cardFocused || dossierDone
              ? "var(--color-accent-secondary)"
              : "transparent",
            transition: "padding 180ms ease-out, background 180ms ease-out",
          }}
        >
          <div
            ref={cardRef}
            onFocus={handleCardFocus}
            onBlur={handleCardBlur}
            className="relative w-full rounded-card p-8"
            style={{
              background: "var(--color-surface-1)",
              border: (cardFocused || dossierDone) ? "none" : "1px solid var(--color-surface-3)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {error && (
              <p
                key={error}
                role="alert"
                className="mb-4 text-center text-xs text-danger"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {error}
              </p>
            )}

            <div className="flex flex-col gap-5">
              {/* Name dropdown */}
              <div>
                <label
                  className="mb-2 block text-[0.75rem] font-medium uppercase tracking-[0.06em] text-text-secondary"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Who are you?
                </label>
                <select
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-input border border-surface-3 bg-surface-1 px-3 py-2.5 text-sm text-text-primary outline-none transition-all duration-[180ms] ease-out focus:border-accent-secondary focus:shadow-focus appearance-none"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                  }}
                >
                  <option value="" disabled style={{ background: "white", color: "#a1a1aa" }}>
                    Select your name...
                  </option>
                  {TEAM_NAMES.map((n) => (
                    <option key={n} value={n} style={{ background: "white", color: "#09090b" }}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div>
                <label
                  className="mb-1.5 block text-[0.75rem] font-medium uppercase tracking-[0.06em] text-text-secondary"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Team password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLogin();
                    }}
                    placeholder="Enter team password"
                    className="w-full rounded-input border border-surface-3 bg-surface-1 px-3 py-2.5 pr-9 text-sm text-text-primary outline-none transition-all duration-[180ms] ease-out placeholder:text-text-tertiary/60 focus:border-accent-secondary focus:shadow-focus"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 flex -translate-y-1/2 cursor-pointer border-none bg-transparent p-0 text-text-tertiary"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Sign In button */}
              <button
                onClick={handleLogin}
                disabled={isDisabled}
                className={`sign-in-btn w-full rounded-input border-none py-[11px] px-4 text-sm font-semibold transition-all duration-[180ms] ease-out ${
                  isDisabled
                    ? "cursor-not-allowed bg-accent-secondary/30 text-text-tertiary"
                    : "cursor-pointer bg-accent-secondary text-white hover:bg-accent-secondary/80"
                }`}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-white" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Simple fade-out on successful login */}
      {loginSuccess && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background: "var(--color-surface-0)",
            animation: "fadeIn 400ms ease-in 200ms both",
          }}
        />
      )}
    </div>
  );
}

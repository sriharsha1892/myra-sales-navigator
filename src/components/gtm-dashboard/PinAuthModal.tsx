"use client";

import { useState, useRef, useCallback } from "react";

interface PinAuthModalProps {
  onSuccess: () => void;
}

export function PinAuthModal({ onSuccess }: PinAuthModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (pin.length !== 12) {
        setError("PIN must be 12 digits");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/gtm-dashboard/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (data.success) {
          onSuccess();
        } else {
          setError("Invalid PIN");
          setPin("");
          inputRef.current?.focus();
        }
      } catch {
        setError("Authentication failed");
      } finally {
        setLoading(false);
      }
    },
    [pin, onSuccess]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#e8ecf3] via-[#f3eff8] to-[#edf5f2]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-8"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          GTM Dashboard
        </h2>
        <p className="text-sm text-gray-500 mb-6">Enter your 12-digit PIN</p>

        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={12}
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setPin(v);
            setError("");
          }}
          placeholder="000000000000"
          autoFocus
          className="w-full px-4 py-3 text-center text-lg tracking-[0.3em] font-mono bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 placeholder:text-gray-300"
        />

        {error && (
          <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || pin.length !== 12}
          className="mt-4 w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-40 hover:bg-gray-800 transition-colors"
        >
          {loading ? "Verifying..." : "Enter"}
        </button>
      </form>
    </div>
  );
}

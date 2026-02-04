"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { cn } from "@/lib/cn";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

interface ToastContextValue {
  addToast: (message: string, type: "success" | "error") => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

export function useGtmToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function GtmToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = `gtm-toast-${++toastId}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg",
                "animate-[slideIn_180ms_ease-out]",
                t.type === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
              )}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

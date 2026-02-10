"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  backdrop?: "dim" | "blur" | "transparent";
  placement?: "center" | "top" | "end";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  lockScroll?: boolean;
  trapFocus?: boolean;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Overlay({
  open,
  onClose,
  children,
  backdrop = "dim",
  placement = "center",
  closeOnBackdrop = true,
  closeOnEscape = true,
  lockScroll = true,
  trapFocus = true,
  className,
}: OverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Capture the element that had focus when the modal opened,
  // and restore focus to it when the modal closes.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    } else if (triggerRef.current) {
      const el = triggerRef.current;
      if (el instanceof HTMLElement) {
        // Use rAF to defer focus restoration until after the portal unmounts
        requestAnimationFrame(() => el.focus());
      }
      triggerRef.current = null;
    }
  }, [open]);

  // Scroll lock
  useEffect(() => {
    if (!open || !lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, lockScroll]);

  // Escape handler
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeOnEscape]);

  // Focus trap
  useEffect(() => {
    if (!open || !trapFocus) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const focusableEls = overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];

    if (firstEl) {
      setTimeout(() => firstEl.focus(), 50);
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const currentFocusable = overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    overlay.addEventListener("keydown", handler);
    return () => overlay.removeEventListener("keydown", handler);
  }, [open, trapFocus]);

  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdrop) {
      onCloseRef.current();
    }
  }, [closeOnBackdrop]);

  if (!open) return null;

  const backdropClass = {
    dim: "bg-text-primary/20",
    blur: "bg-black/60 backdrop-blur-sm",
    transparent: "",
  }[backdrop];

  const placementClass = {
    center: "items-center justify-center",
    top: "items-start justify-center pt-[20vh]",
    end: "items-start justify-end",
  }[placement];

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      className={cn("fixed inset-0 z-50 flex", placementClass)}
      data-state="open"
    >
      <div
        className={cn("absolute inset-0", backdropClass)}
        onClick={handleBackdropClick}
      />
      <div
        className={cn("relative", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

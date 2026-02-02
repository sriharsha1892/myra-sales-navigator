"use client";

interface MissingDataProps {
  label: string;
}

export function MissingData({ label }: MissingDataProps) {
  return (
    <span className="text-xs italic text-text-tertiary">{label}</span>
  );
}

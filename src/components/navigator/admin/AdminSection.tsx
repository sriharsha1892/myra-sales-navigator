"use client";

export function AdminSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-surface-3 bg-surface-1 p-5">
      <h2 className="mb-4 font-display text-base text-text-primary">{title}</h2>
      {description && (
        <p className="mb-4 text-xs text-text-tertiary">{description}</p>
      )}
      {children}
    </div>
  );
}

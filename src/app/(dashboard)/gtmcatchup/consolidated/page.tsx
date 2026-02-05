"use client";

import dynamic from "next/dynamic";

const ConsolidatedPageInner = dynamic(
  () => import("../_components/ConsolidatedPageInner"),
  { ssr: false }
);

export default function ConsolidatedPage() {
  return <ConsolidatedPageInner />;
}

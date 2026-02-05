"use client";

import dynamic from "next/dynamic";

const AmPerformancePageInner = dynamic(
  () => import("../_components/AmPerformancePageInner"),
  { ssr: false }
);

export default function AmPerformancePage() {
  return <AmPerformancePageInner />;
}

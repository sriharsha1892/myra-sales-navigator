"use client";

import dynamic from "next/dynamic";

const DashboardPageInner = dynamic(
  () => import("./_components/DashboardPageInner"),
  { ssr: false }
);

export default function GtmDashboardPage() {
  return <DashboardPageInner />;
}

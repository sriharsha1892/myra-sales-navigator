"use client";

import dynamic from "next/dynamic";

const CatchupPageInner = dynamic(
  () => import("./_components/CatchupPageInner"),
  { ssr: false }
);

export default function GtmCatchupPage() {
  return <CatchupPageInner />;
}

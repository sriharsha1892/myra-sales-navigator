"use client";

import dynamic from "next/dynamic";

const EntryPageInner = dynamic(
  () => import("../_components/EntryPageInner"),
  { ssr: false }
);

export default function GtmEntryPage() {
  return <EntryPageInner />;
}

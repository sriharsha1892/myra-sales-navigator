"use client";

import dynamic from "next/dynamic";

const AdminPageInner = dynamic(
  () => import("./_components/AdminPageInner"),
  { ssr: false }
);

export default function GtmAdminPage() {
  return <AdminPageInner />;
}

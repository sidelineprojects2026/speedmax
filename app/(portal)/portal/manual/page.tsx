import type { Metadata } from "next";
import { ManualView } from "@/components/manual/ManualView";

export const metadata: Metadata = { title: "User Manual" };

export default function PortalManualPage() {
  return <ManualView audience="customer" workspaceLabel="customer portal" />;
}

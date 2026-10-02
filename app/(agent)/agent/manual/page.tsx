import type { Metadata } from "next";
import { ManualView } from "@/components/manual/ManualView";

export const metadata: Metadata = { title: "User Manual" };

export default function AgentManualPage() {
  return <ManualView audience="agent" workspaceLabel="agent portal" />;
}

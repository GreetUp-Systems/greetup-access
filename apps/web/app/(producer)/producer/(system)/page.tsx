import type { Metadata } from "next";

import { DashboardScreen } from "../../../_components/producer/DashboardScreen";

export const metadata: Metadata = {
  title: "Painel · Access",
};

export default function DashboardPage() {
  return <DashboardScreen />;
}

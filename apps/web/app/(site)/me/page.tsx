import type { Metadata } from "next";

import { AccountScreen } from "../../_components/site/AccountScreen";

export const metadata: Metadata = { title: "Conta · Access" };

/** `/me`: the Conta (SPEC-016 §6). */
export default function AccountPage() {
  return <AccountScreen />;
}

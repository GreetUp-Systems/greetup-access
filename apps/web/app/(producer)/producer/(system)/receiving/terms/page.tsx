import type { Metadata } from "next";
import { Suspense } from "react";

import { TermsScreen } from "../../../../../_components/producer/receiving/TermsScreen";

export const metadata: Metadata = {
  title: "Termos da BlindPay · Access",
};

export default function TermsPage() {
  return (
    <Suspense>
      <TermsScreen />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { ReceivingRootScreen } from "../../../../_components/producer/receiving/ReceivingRootScreen";

export const metadata: Metadata = {
  title: "Recebimento · Access",
};

export default function ReceivingPage() {
  return (
    <Suspense>
      <ReceivingRootScreen />
    </Suspense>
  );
}

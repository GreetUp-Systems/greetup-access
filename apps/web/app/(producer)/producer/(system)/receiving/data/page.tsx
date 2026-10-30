import type { Metadata } from "next";
import { Suspense } from "react";

import { DataScreen } from "../../../../../_components/producer/receiving/DataScreen";

export const metadata: Metadata = {
  title: "Seus dados · Access",
};

export default function DataPage() {
  return (
    <Suspense>
      <DataScreen />
    </Suspense>
  );
}

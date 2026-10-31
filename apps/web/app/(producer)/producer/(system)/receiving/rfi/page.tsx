import type { Metadata } from "next";
import { Suspense } from "react";

import { RfiScreen } from "../../../../../_components/producer/receiving/RfiScreen";

export const metadata: Metadata = {
  title: "Pedido de informações · Access",
};

export default function RfiPage() {
  return (
    <Suspense>
      <RfiScreen />
    </Suspense>
  );
}

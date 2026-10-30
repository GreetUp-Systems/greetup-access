import type { Metadata } from "next";
import { Suspense } from "react";

import { DocumentsScreen } from "../../../../../_components/producer/receiving/DocumentsScreen";

export const metadata: Metadata = {
  title: "Documentos · Access",
};

export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsScreen />
    </Suspense>
  );
}

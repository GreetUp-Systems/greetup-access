import type { Metadata } from "next";

import { CheckoutScreen } from "../../_components/checkout/CheckoutScreen";
import { Providers } from "../../_components/Providers";

export const metadata: Metadata = { title: "Seu pedido · Access" };

interface PageProps {
  params: Promise<{ purchaseId: string }>;
}

/** The checkout runs in the browser: it belongs to the signed-in buyer (SPEC-014 §7). */
export default async function CheckoutPage({ params }: PageProps) {
  const { purchaseId } = await params;
  return (
    <Providers>
      <CheckoutScreen purchaseId={purchaseId} />
    </Providers>
  );
}

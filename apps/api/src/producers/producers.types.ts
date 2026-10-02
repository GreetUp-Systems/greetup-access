export interface ProducerProfileView {
  id: string;
  displayName: string;
  onboardingStatus:
    | "profile_created"
    | "compliance_pending"
    | "stellar_pending"
    | "wallet_registration_pending"
    | "ready";
  compliance: {
    status: "verifying" | "approved" | "rejected" | "compliance_request" | "approved_rfi" | null;
    hasOpenRfi: boolean;
  };
  stellar: {
    status: "not_started" | "pending" | "signing" | "submitted" | "active" | "failed";
  };
}

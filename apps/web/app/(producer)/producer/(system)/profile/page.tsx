import type { Metadata } from "next";

import { ProfileScreen } from "../../../../_components/producer/ProfileScreen";

export const metadata: Metadata = {
  title: "Perfil do produtor · Access",
};

export default function ProfilePage() {
  return <ProfileScreen />;
}

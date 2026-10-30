import type { Metadata } from "next";

import { CreateProfileScreen } from "../../../_components/producer/CreateProfileScreen";

export const metadata: Metadata = {
  title: "Criar perfil · Access",
};

export default function CreateProfilePage() {
  return <CreateProfileScreen />;
}

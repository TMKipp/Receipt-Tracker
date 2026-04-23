import { Suspense } from "react";

import { AppAccountWorkspace } from "@/components/app-account-workspace";

export default function AuthenticatedAccountPage() {
  return (
    <Suspense fallback={null}>
      <AppAccountWorkspace />
    </Suspense>
  );
}

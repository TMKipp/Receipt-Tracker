import { Suspense } from "react";

import { AppInboxWorkspace } from "@/components/app-inbox-workspace";

export default function AuthenticatedAppHomePage() {
  return (
    <Suspense fallback={null}>
      <AppInboxWorkspace />
    </Suspense>
  );
}

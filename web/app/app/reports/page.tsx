import { Suspense } from "react";

import { AppReportsWorkspace } from "@/components/app-reports-workspace";

export default function AuthenticatedReportsPage() {
  return (
    <Suspense fallback={null}>
      <AppReportsWorkspace />
    </Suspense>
  );
}

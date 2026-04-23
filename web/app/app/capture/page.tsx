import { Suspense } from "react";

import { AppCaptureWorkspace } from "@/components/app-capture-workspace";

export default function AuthenticatedCapturePage() {
  return (
    <Suspense fallback={null}>
      <AppCaptureWorkspace />
    </Suspense>
  );
}

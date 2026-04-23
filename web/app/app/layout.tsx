import type { ReactNode } from "react";

import { OperatorAppShell } from "@/components/operator-app-shell";

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  return (
    <OperatorAppShell
      title="Review receipts, approve what is correct, and keep the books current."
      description="Everything here is organized around one simple workflow: open a receipt, confirm the important fields, then sync one clean record to QuickBooks and Excel."
      meta={
        <div className="operator-app-summary">
          <div>
            <span>To review</span>
            <strong>14 receipts</strong>
            <small>These are the receipts waiting for a quick trust check.</small>
          </div>
          <div>
            <span>Synced today</span>
            <strong>21 posted</strong>
            <small>Approved receipts already reached QuickBooks and Excel.</small>
          </div>
          <div>
            <span>Connections</span>
            <strong>2 healthy</strong>
            <small>QuickBooks and Excel are both available for the next approval.</small>
          </div>
        </div>
      }
    >
      {children}
    </OperatorAppShell>
  );
}

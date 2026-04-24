import type { ReactNode } from "react";

import { OperatorAppShell } from "@/components/operator-app-shell";

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  return (
    <OperatorAppShell
      title="Review receipts and keep the books current."
      description="Open the next receipt, confirm the key fields, then send one clean record to QuickBooks and Excel."
      meta={
        <div className="operator-app-summary operator-app-summary-compact">
          <div>
            <span>To review</span>
            <strong>14</strong>
            <small>Waiting now</small>
          </div>
          <div>
            <span>Synced today</span>
            <strong>21</strong>
            <small>Posted cleanly</small>
          </div>
          <div>
            <span>Connections</span>
            <strong>2 healthy</strong>
            <small>QuickBooks + Excel</small>
          </div>
        </div>
      }
    >
      {children}
    </OperatorAppShell>
  );
}

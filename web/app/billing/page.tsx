import { BillingWorkspace } from "@/components/billing-workspace";
import { OpsShell } from "@/components/ops-shell";

export default function BillingPage() {
  return (
    <OpsShell
      eyebrow="Billing"
      title="Keep the paywall operational, not mysterious."
      description="Trial state, entitlement health, and workbook access should be visible to support and obvious to the customer."
      rail={
        <div className="mini-stat-stack">
          <div>
            <span>Launch trial</span>
            <strong>14 days</strong>
          </div>
          <div>
            <span>Gated action</span>
            <strong>New syncs</strong>
          </div>
          <div>
            <span>History access</span>
            <strong>Always visible</strong>
          </div>
        </div>
      }
    >
      <BillingWorkspace />
    </OpsShell>
  );
}

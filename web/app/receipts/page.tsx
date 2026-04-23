import { OpsShell } from "@/components/ops-shell";
import { ReceiptOperationsWorkspace } from "@/components/receipt-operations-workspace";

export default function ReceiptsPage() {
  return (
    <OpsShell
      eyebrow="Receipt operations"
      title="Review the queue the way an operator actually works."
      description="The layout stays opinionated: inbox on the left, trust decisions in the middle, and accounting context on the right."
      rail={
        <div className="mini-stat-stack">
          <div>
            <span>Lane rule</span>
            <strong>Human first</strong>
          </div>
          <div>
            <span>Export fallback</span>
            <strong>CSV ready</strong>
          </div>
          <div>
            <span>Posting goal</span>
            <strong>Trust first</strong>
          </div>
        </div>
      }
    >
      <ReceiptOperationsWorkspace />
    </OpsShell>
  );
}

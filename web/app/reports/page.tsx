import { OpsShell } from "@/components/ops-shell";
import { ReportsWorkspace } from "@/components/reports-workspace";

export default function ReportsPage() {
  return (
    <OpsShell
      eyebrow="Reporting"
      title="Show the owner what changed, not just what exists."
      description="The first report pass favors spending deltas, category mix, and sync confidence over decorative charts."
      rail={
        <div className="mini-stat-stack">
          <div>
            <span>Default lens</span>
            <strong>Month to date</strong>
          </div>
          <div>
            <span>Primary story</span>
            <strong>Spend drift</strong>
          </div>
          <div>
            <span>Support use</span>
            <strong>Launch ready</strong>
          </div>
        </div>
      }
    >
      <ReportsWorkspace />
    </OpsShell>
  );
}

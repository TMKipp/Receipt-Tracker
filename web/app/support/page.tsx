import { OpsShell } from "@/components/ops-shell";
import { SupportWorkspace } from "@/components/support-workspace";

export default function SupportPage() {
  return (
    <OpsShell
      eyebrow="Support"
      title="Make support a designed part of the commercial product."
      description="This surface helps the team see setup blockers, sync pressure, and billing recovery without bouncing between pages or guessing what the user is feeling."
      rail={
        <div className="mini-stat-stack">
          <div>
            <span>Primary goal</span>
            <strong>Fast recovery</strong>
          </div>
          <div>
            <span>Secondary goal</span>
            <strong>Less guesswork</strong>
          </div>
          <div>
            <span>Launch posture</span>
            <strong>Support-ready</strong>
          </div>
        </div>
      }
    >
      <SupportWorkspace />
    </OpsShell>
  );
}

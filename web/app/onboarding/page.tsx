import { OnboardingWorkspace } from "@/components/onboarding-workspace";
import { OpsShell } from "@/components/ops-shell";

export default function OnboardingPage() {
  return (
    <OpsShell
      eyebrow="Setup"
      title="Make the first-run journey feel inevitable."
      description="This onboarding pass is built around one goal: a new owner should connect the stack, capture a receipt, and trust the first sync without reading a manual."
      rail={
        <div className="mini-stat-stack">
          <div>
            <span>Activation target</span>
            <strong>Under 5 min</strong>
          </div>
          <div>
            <span>First proof</span>
            <strong>1 posted receipt</strong>
          </div>
          <div>
            <span>Auto-approve</span>
            <strong>Still off</strong>
          </div>
        </div>
      }
    >
      <OnboardingWorkspace />
    </OpsShell>
  );
}

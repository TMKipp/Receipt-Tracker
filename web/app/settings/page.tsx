import { OpsShell } from "@/components/ops-shell";
import { SettingsWorkspace } from "@/components/settings-workspace";

export default function SettingsPage() {
  return (
    <OpsShell
      eyebrow="Settings"
      title="Account controls should make support easier, not harder."
      description="The companion web app handles the account edges that are awkward on mobile: integrations, workbook setup, exports, billing posture, and trust defaults."
      rail={
        <div className="mini-stat-stack">
          <div>
            <span>Market</span>
            <strong>U.S. only</strong>
          </div>
          <div>
            <span>Currency</span>
            <strong>USD</strong>
          </div>
          <div>
            <span>Review rule</span>
            <strong>Human first</strong>
          </div>
        </div>
      }
    >
      <SettingsWorkspace />
    </OpsShell>
  );
}

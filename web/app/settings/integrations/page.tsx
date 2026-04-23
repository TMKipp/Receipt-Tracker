import { IntegrationsWorkspace } from "@/components/integrations-workspace";
import { OpsShell } from "@/components/ops-shell";

export default function IntegrationsPage() {
  return (
    <OpsShell
      eyebrow="Integrations"
      title="Connection health needs its own calm workspace."
      description="QuickBooks, Microsoft, and workbook binding live here so onboarding and support can resolve issues without leaving the app."
      rail={
        <div className="mini-stat-stack">
          <div>
            <span>Sync targets</span>
            <strong>2 total</strong>
          </div>
          <div>
            <span>Workbook rule</span>
            <strong>Always pinned</strong>
          </div>
          <div>
            <span>Support goal</span>
            <strong>No guessing</strong>
          </div>
        </div>
      }
    >
      <IntegrationsWorkspace />
    </OpsShell>
  );
}

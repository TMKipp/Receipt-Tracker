"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getBillingSnapshot,
  getIntegrationHealth,
  getReceiptSummary,
  type BillingSnapshotResponse,
  type IntegrationHealthResponse,
  type ReceiptSummaryResponse,
} from "@/lib/backend-api";
import { getDefaultDemoIdentity } from "@/lib/demo-identity";

const defaultDemoIdentity = getDefaultDemoIdentity();

export function SupportWorkspace() {
  const [summary, setSummary] = useState<ReceiptSummaryResponse | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealthResponse | null>(null);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSupportPosture() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [summaryResponse, integrationResponse, billingResponse] = await Promise.all([
          getReceiptSummary(defaultDemoIdentity),
          getIntegrationHealth(defaultDemoIdentity),
          getBillingSnapshot(defaultDemoIdentity),
        ]);

        if (isCancelled) return;

        setSummary(summaryResponse);
        setIntegrationHealth(integrationResponse);
        setBillingSnapshot(billingResponse);
      } catch (error) {
        if (isCancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load support posture.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSupportPosture();

    return () => {
      isCancelled = true;
    };
  }, []);

  const playbooks = [
    {
      title: "Sync failures",
      detail:
        (summary?.failed ?? 0) > 0
          ? `${summary?.failed ?? 0} receipts are currently failing, so retry paths should stay close to the review lane.`
          : "No failed receipts are visible right now, which is the benchmark to keep after launch.",
    },
    {
      title: "Integration checks",
      detail:
        (integrationHealth?.sync_ready_targets.length ?? 0) < 2
          ? "One or more sync targets still need work, so onboarding and support should route users through integration health first."
          : "Both sync targets are ready, so support can focus on workflow questions instead of setup blockers.",
    },
    {
      title: "Billing recovery",
      detail: billingSnapshot?.entitlement.paywall_required
        ? "Billing is currently gating new syncs, so recovery copy should stay clear and immediate."
        : "Billing is not currently blocking usage, so support can stay focused on setup and trust.",
    },
  ];

  const escalationPaths = [
    {
      label: "Open integrations",
      href: "/settings/integrations",
    },
    {
      label: "Restore billing access",
      href: "/restore-access",
    },
    {
      label: "Return to receipts",
      href: "/receipts",
    },
    {
      label: "Review first-run flow",
      href: "/onboarding",
    },
  ];

  const customerExperienceStandards = [
    "Sync failures should always map to a clear next step, not an opaque error code.",
    "Trial and billing recovery should preserve trust by keeping history readable.",
    "Support should be able to answer setup and sync questions from the product state itself.",
  ];

  return (
    <div className="workspace-stack">
      <section className="panel panel-emphasis">
        <div className="pane-heading">
          <div>
            <p className="pane-label">Support center</p>
            <h2>Make recovery feel as designed as the happy path.</h2>
          </div>
          <span>Beta support posture</span>
        </div>
        <p className="section-intro">
          The support surface should help the team triage setup, sync, and billing friction without forcing anyone to
          reverse-engineer the product from scattered screens.
        </p>

        {loadError ? <div className="workspace-message workspace-message-error">{loadError}</div> : null}
        {isLoading ? <div className="workspace-message">Loading support context from the backend...</div> : null}

        {!isLoading && !loadError ? (
          <div className="ops-kpi-grid">
            <article className="ops-kpi">
              <span>Needs review</span>
              <strong>{summary?.review_required ?? 0}</strong>
              <p>Review pressure should be visible before it turns into support pain.</p>
            </article>
            <article className="ops-kpi">
              <span>Failed receipts</span>
              <strong>{summary?.failed ?? 0}</strong>
              <p>These are the first incidents support will need to explain.</p>
            </article>
            <article className="ops-kpi">
              <span>Sync targets ready</span>
              <strong>{integrationHealth?.sync_ready_targets.length ?? 0}/2</strong>
              <p>Setup questions usually start here.</p>
            </article>
            <article className="ops-kpi">
              <span>Billing posture</span>
              <strong>{billingSnapshot?.entitlement.paywall_required ? "Recovery" : "Clear"}</strong>
              <p>Support needs this status without hunting for it.</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Support playbooks</p>
              <h2>What the team should check first</h2>
            </div>
          </div>
          <div className="support-playbook-list">
            {playbooks.map((playbook) => (
              <article key={playbook.title} className="support-playbook">
                <strong>{playbook.title}</strong>
                <p>{playbook.detail}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Escalation paths</p>
              <h2>Move the user to the right fix quickly</h2>
            </div>
          </div>
          <div className="action-link-grid">
            {escalationPaths.map((path) => (
              <Link key={path.href} href={path.href} className="action-link-card">
                <strong>{path.label}</strong>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Design principle</p>
              <h2>Support is part of the product, not a back office afterthought</h2>
            </div>
          </div>
          <p className="section-note">
            If the app explains setup state, sync blockers, and billing recovery clearly enough, support becomes faster,
            calmer, and much less dependent on internal memory.
          </p>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Next move</p>
              <h2>Keep the product moving forward</h2>
            </div>
          </div>
          <div className="action-link-row">
            <Link href="/receipts">Open receipt lane</Link>
            <Link href="/billing" className="secondary">
              Review billing posture
            </Link>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="pane-heading">
          <div>
            <p className="pane-label">Customer experience standards</p>
            <h2>Support should reinforce the product promise, not rescue the user from it</h2>
          </div>
        </div>
        <div className="insight-list">
          {customerExperienceStandards.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </div>
  );
}

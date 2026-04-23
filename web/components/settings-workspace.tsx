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

export function SettingsWorkspace() {
  const [summary, setSummary] = useState<ReceiptSummaryResponse | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealthResponse | null>(null);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadSettings() {
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
        setLoadError(error instanceof Error ? error.message : "Unable to load settings data.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isCancelled = true;
    };
  }, []);

  const trialDaysRemaining = billingSnapshot?.entitlement.trial_days_remaining ?? null;
  const readyTargets = integrationHealth?.sync_ready_targets.length ?? 0;
  const workbookLinked = billingSnapshot?.workbook_binding ? "Linked" : "Pending";

  const operatorGuidance = [
    summary?.review_required
      ? `${summary.review_required} receipts still need review, so auto-approve should remain off until the owner trusts the flow.`
      : "The review lane is clear enough to start testing a tighter auto-approve policy later.",
    readyTargets < 2
      ? "One or more sync targets still need setup, so settings should keep integrations visible and obvious."
      : "Both sync targets are ready, which means settings can shift from setup to guardrails and defaults.",
    billingSnapshot?.entitlement.paywall_required
      ? "Billing is currently gating new sync actions, so recovery copy should stay close to the workflow."
      : "Billing is not blocking the workflow, so the account is safe to continue onboarding.",
  ];

  return (
    <div className="workspace-stack">
      <section className="panel panel-emphasis">
        <div className="pane-heading">
          <div>
            <p className="pane-label">Account posture</p>
            <h2>Keep the controls practical enough for a busy owner.</h2>
          </div>
          <span>U.S. owner-operator defaults</span>
        </div>
        <p className="section-intro">
          Settings should not feel like a junk drawer. This surface exists to confirm launch defaults, reveal what is
          still incomplete, and route the owner to the next meaningful action.
        </p>

        {loadError ? <div className="workspace-message workspace-message-error">{loadError}</div> : null}
        {isLoading ? <div className="workspace-message">Loading settings posture from the backend...</div> : null}

        {!isLoading && !loadError ? (
          <div className="ops-kpi-grid">
            <article className="ops-kpi">
              <span>Needs review</span>
              <strong>{summary?.review_required ?? 0}</strong>
              <p>Human review remains the trust layer for anything unclear.</p>
            </article>
            <article className="ops-kpi">
              <span>Sync targets ready</span>
              <strong>{readyTargets}/2</strong>
              <p>QuickBooks and Excel should both be visible from this surface.</p>
            </article>
            <article className="ops-kpi">
              <span>Workbook state</span>
              <strong>{workbookLinked}</strong>
              <p>{billingSnapshot?.workbook_binding?.table_name || "No Excel table is pinned yet."}</p>
            </article>
            <article className="ops-kpi">
              <span>Trial state</span>
              <strong>{trialDaysRemaining === null ? "Paid" : `${trialDaysRemaining}d`}</strong>
              <p>
                {billingSnapshot?.entitlement.paywall_required
                  ? "Billing recovery is required before new syncs can post."
                  : "Billing access is not blocking setup right now."}
              </p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Commercial defaults</p>
              <h2>The account rules that shape the MVP</h2>
            </div>
          </div>
          <div className="detail-pairs">
            <div>
              <span>Country</span>
              <strong>United States</strong>
            </div>
            <div>
              <span>Base currency</span>
              <strong>USD</strong>
            </div>
            <div>
              <span>Auto-approve</span>
              <strong>Off until onboarding is complete</strong>
            </div>
            <div>
              <span>Export fallback</span>
              <strong>CSV always available</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Operator guidance</p>
              <h2>What this page should help the owner decide</h2>
            </div>
          </div>
          <div className="insight-list">
            {operatorGuidance.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </article>
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Launch routes</p>
              <h2>Send the owner to the next useful place</h2>
            </div>
          </div>
          <div className="action-link-row">
            <Link href="/onboarding">Open setup guide</Link>
            <Link href="/settings/integrations" className="secondary">
              Review integrations
            </Link>
            <Link href="/billing" className="secondary">
              Check billing posture
            </Link>
            <Link href="/receipts" className="secondary">
              Return to receipt lane
            </Link>
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Why this matters</p>
              <h2>Settings should lower support load, not create it</h2>
            </div>
          </div>
          <p className="section-note">
            When this page is working, the owner can understand setup status, billing pressure, and trust rules without
            reading help docs or sending support a screenshot.
          </p>
        </article>
      </section>
    </div>
  );
}

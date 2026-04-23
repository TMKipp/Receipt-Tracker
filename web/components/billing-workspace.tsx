"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getBillingSnapshot,
  getIntegrationHealth,
  type BillingSnapshotResponse,
  type IntegrationHealthResponse,
} from "@/lib/backend-api";
import { getDefaultDemoIdentity } from "@/lib/demo-identity";

const defaultDemoIdentity = getDefaultDemoIdentity();

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function BillingWorkspace() {
  const [billing, setBilling] = useState<BillingSnapshotResponse | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadBilling() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [billingResponse, healthResponse] = await Promise.all([
          getBillingSnapshot(defaultDemoIdentity),
          getIntegrationHealth(defaultDemoIdentity),
        ]);

        if (isCancelled) return;

        setBilling(billingResponse);
        setIntegrationHealth(healthResponse);
      } catch (error) {
        if (isCancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load billing data.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBilling();

    return () => {
      isCancelled = true;
    };
  }, []);

  const entitlement = billing?.entitlement;
  const entitlementRecord = entitlement?.entitlement ?? null;
  const trialDaysRemaining = entitlement?.trial_days_remaining ?? null;
  const accessState = entitlement?.paywall_required
    ? "Action needed"
    : trialDaysRemaining !== null
      ? "Trialing"
      : entitlement?.active
        ? "Paid"
        : "Pending";

  const lifecycleItems = [
    {
      key: "trial",
      label: "Trial active",
      detail: "Capture, review, and connect the accounting stack before the paywall becomes relevant.",
      active: trialDaysRemaining !== null && !entitlement?.paywall_required,
    },
    {
      key: "paid",
      label: "Paid access",
      detail: "Keep sync available, preserve audit history, and treat RevenueCat as the entitlement source of truth.",
      active: trialDaysRemaining === null && entitlement?.active && !entitlement?.paywall_required,
    },
    {
      key: "restore",
      label: "Restore needed",
      detail: "Pause new sync actions, keep history readable, and route the user to a clear recovery path.",
      active: !!entitlement?.paywall_required,
    },
  ];

  const supportNotes = [
    trialDaysRemaining !== null
      ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} remain in the launch trial.`
      : "Trial timing is no longer the active story for this account.",
    billing?.workbook_binding
      ? "Workbook binding is already in place, so billing state and sync readiness stay aligned."
      : "Excel still needs a workbook binding before the paid promise feels complete.",
    integrationHealth && integrationHealth.sync_ready_targets.length < 2
      ? "One or more sync targets are still unavailable, so billing copy should stay careful about live sync claims."
      : "Both sync targets can be positioned as ready once the backend services are healthy.",
  ];

  return (
    <div className="workspace-stack">
      <section className="panel panel-emphasis">
        <div className="pane-heading">
          <div>
            <p className="pane-label">Billing posture</p>
            <h2>Make entitlement state feel operational, not hidden.</h2>
          </div>
          <span>{entitlementRecord?.provider || "RevenueCat pending"}</span>
        </div>
        <p className="section-intro">
          The billing surface should answer three questions fast: does this account have access, when does that change,
          and what else in the product is affected when it does.
        </p>

        {loadError ? <div className="workspace-message workspace-message-error">{loadError}</div> : null}
        {isLoading ? <div className="workspace-message">Loading billing state from the backend...</div> : null}

        {!isLoading && !loadError ? (
          <div className="ops-kpi-grid">
            <article className="ops-kpi">
              <span>Access state</span>
              <strong>{accessState}</strong>
              <p>
                {entitlement?.paywall_required
                  ? "New sync actions are gated right now."
                  : "Capture and sync remain available."}
              </p>
            </article>
            <article className="ops-kpi">
              <span>Trial runway</span>
              <strong>{trialDaysRemaining === null ? "Closed" : `${trialDaysRemaining}d`}</strong>
              <p>
                {trialDaysRemaining === null
                  ? "This account is either paid or outside the launch trial."
                  : "Use this window to show value before renewal."}
              </p>
            </article>
            <article className="ops-kpi">
              <span>Workbook linked</span>
              <strong>{billing?.workbook_binding ? "Yes" : "No"}</strong>
              <p>{billing?.workbook_binding?.table_name || "Excel sync still needs a pinned table."}</p>
            </article>
            <article className="ops-kpi">
              <span>Sync-ready targets</span>
              <strong>{integrationHealth?.sync_ready_targets.length ?? 0}/2</strong>
              <p>Billing promises should match what the integrations page can prove.</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Lifecycle</p>
              <h2>Show the customer what changes next</h2>
            </div>
          </div>
          <div className="timeline-list">
            {lifecycleItems.map((item) => (
              <article key={item.key} className={`timeline-item ${item.active ? "is-active" : ""}`}>
                <div className="timeline-dot" aria-hidden="true" />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Entitlement record</p>
              <h2>Make the subscription trail supportable</h2>
            </div>
          </div>
          <div className="detail-pairs">
            <div>
              <span>Entitlement key</span>
              <strong>{entitlementRecord?.entitlement_key || "Pending"}</strong>
            </div>
            <div>
              <span>Product</span>
              <strong>{entitlementRecord?.product_id || "Pending"}</strong>
            </div>
            <div>
              <span>Trial ends</span>
              <strong>{formatDate(entitlementRecord?.trial_ends_at ?? null)}</strong>
            </div>
            <div>
              <span>Latest event</span>
              <strong>{formatDate(entitlementRecord?.latest_event_at ?? null)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Support notes</p>
              <h2>Keep renewal and recovery copy grounded in reality</h2>
            </div>
          </div>
          <div className="insight-list">
            {supportNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Operational follow-through</p>
              <h2>Billing should always connect back to the workflow</h2>
            </div>
          </div>
          <div className="action-link-row">
            <Link href="/settings/integrations">Open integrations</Link>
            <Link href="/restore-access" className="secondary">
              View restore flow
            </Link>
            <Link href="/receipts" className="secondary">
              Return to receipt lane
            </Link>
          </div>
          <p className="section-note">
            When billing tightens access, the user should still be able to see history and understand exactly what to
            do next.
          </p>
        </article>
      </section>
    </div>
  );
}

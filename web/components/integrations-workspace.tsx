"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getIntegrationHealth, type IntegrationHealthResponse } from "@/lib/backend-api";
import { getDefaultDemoIdentity } from "@/lib/demo-identity";

const defaultDemoIdentity = getDefaultDemoIdentity();

function formatTimestamp(value: string | null) {
  if (!value) return "Not yet recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function labelForStatus(status: string) {
  return status.replace(/_/g, " ");
}

function toneForStatus(status: string) {
  if (status.includes("connected") || status.includes("active") || status.includes("ready")) {
    return "status-pill status-good";
  }
  if (status.includes("pending") || status.includes("refresh") || status.includes("queued")) {
    return "status-pill status-warn";
  }
  return "status-pill status-bad";
}

export function IntegrationsWorkspace() {
  const [health, setHealth] = useState<IntegrationHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadIntegrations() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await getIntegrationHealth(defaultDemoIdentity);
        if (isCancelled) return;
        setHealth(response);
      } catch (error) {
        if (isCancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load integration health.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadIntegrations();

    return () => {
      isCancelled = true;
    };
  }, []);

  const readyTargets = health?.sync_ready_targets ?? [];
  const workbookBinding = health?.workbook_binding ?? null;

  const integrationNotes = [
    health?.quickbooks.status !== "connected"
      ? "QuickBooks still needs a healthy token and imported chart of accounts before launch confidence is real."
      : "QuickBooks is connected, so approved receipts can move straight into the accounting record.",
    health?.microsoft.status !== "connected"
      ? "Microsoft still needs a live workbook binding before Excel can be sold as a real sync target."
      : "Microsoft is connected and ready to validate workbook writes.",
    workbookBinding
      ? `Workbook ${workbookBinding.workbook_name ?? "Unnamed workbook"} is pinned and ready for row validation.`
      : "No workbook is pinned yet, so Excel sync should stay visibly incomplete to the customer.",
  ];

  return (
    <div className="workspace-stack">
      <section className="panel panel-emphasis">
        <div className="pane-heading">
          <div>
            <p className="pane-label">Connection posture</p>
            <h2>Two external systems. One calm place to see the truth.</h2>
          </div>
          <span>{readyTargets.length} sync targets ready</span>
        </div>
        <p className="section-intro">
          This page should be strong enough for onboarding and support. The user should never need to guess whether the
          accounting path is healthy, missing permissions, or waiting on workbook setup.
        </p>

        {loadError ? <div className="workspace-message workspace-message-error">{loadError}</div> : null}
        {isLoading ? <div className="workspace-message">Loading integration health from the backend...</div> : null}

        {!isLoading && !loadError ? (
          <div className="ops-kpi-grid">
            <article className="ops-kpi">
              <span>QuickBooks</span>
              <strong>{health ? labelForStatus(health.quickbooks.status) : "Pending"}</strong>
              <p>{health?.quickbooks.external_tenant_name || "Tenant name will appear here once connected."}</p>
            </article>
            <article className="ops-kpi">
              <span>Microsoft</span>
              <strong>{health ? labelForStatus(health.microsoft.status) : "Pending"}</strong>
              <p>{health?.microsoft.external_tenant_name || "Workbook authority will show here once connected."}</p>
            </article>
            <article className="ops-kpi">
              <span>Workbook binding</span>
              <strong>{workbookBinding ? "Pinned" : "Missing"}</strong>
              <p>{workbookBinding?.table_name || "Bind a workbook table so Excel writes have a destination."}</p>
            </article>
            <article className="ops-kpi">
              <span>Sync ready</span>
              <strong>{readyTargets.length}/2</strong>
              <p>The product only feels finished when both accounting paths are operational.</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="connection-header">
            <div>
              <p className="pane-label">QuickBooks</p>
              <h2>Expense sync source of truth</h2>
            </div>
            <span className={toneForStatus(health?.quickbooks.status ?? "pending")}>
              {labelForStatus(health?.quickbooks.status ?? "pending")}
            </span>
          </div>
          <div className="detail-pairs">
            <div>
              <span>Connected account</span>
              <strong>{health?.quickbooks.external_tenant_name || "Waiting for OAuth"}</strong>
            </div>
            <div>
              <span>Scopes</span>
              <strong>{health?.quickbooks.scopes.length ?? 0} granted</strong>
            </div>
            <div>
              <span>Connected at</span>
              <strong>{formatTimestamp(health?.quickbooks.connected_at ?? null)}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="connection-header">
            <div>
              <p className="pane-label">Microsoft</p>
              <h2>Workbook append path</h2>
            </div>
            <span className={toneForStatus(health?.microsoft.status ?? "pending")}>
              {labelForStatus(health?.microsoft.status ?? "pending")}
            </span>
          </div>
          <div className="detail-pairs">
            <div>
              <span>Connected account</span>
              <strong>{health?.microsoft.external_tenant_name || "Waiting for OAuth"}</strong>
            </div>
            <div>
              <span>Scopes</span>
              <strong>{health?.microsoft.scopes.length ?? 0} granted</strong>
            </div>
            <div>
              <span>Connected at</span>
              <strong>{formatTimestamp(health?.microsoft.connected_at ?? null)}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Workbook binding</p>
              <h2>Give Excel a precise landing zone</h2>
            </div>
          </div>
          <div className="detail-pairs">
            <div>
              <span>Workbook</span>
              <strong>{workbookBinding?.workbook_name || "Not bound yet"}</strong>
            </div>
            <div>
              <span>Worksheet</span>
              <strong>{workbookBinding?.worksheet_name || "Not selected"}</strong>
            </div>
            <div>
              <span>Table</span>
              <strong>{workbookBinding?.table_name || "Not selected"}</strong>
            </div>
            <div>
              <span>Last validated</span>
              <strong>{formatTimestamp(workbookBinding?.last_validated_at ?? null)}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Operator notes</p>
              <h2>What this surface should make obvious</h2>
            </div>
          </div>
          <div className="insight-list">
            {integrationNotes.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          <div className="action-link-row">
            <Link href="/receipts">Open receipt lane</Link>
            <Link href="/billing" className="secondary">
              Review trial state
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

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

type ProgressState = "complete" | "active" | "pending";

type StepDefinition = {
  key: string;
  label: string;
  detail: string;
  href: string;
  state: ProgressState;
};

export function LaunchProgressRibbon() {
  const [summary, setSummary] = useState<ReceiptSummaryResponse | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealthResponse | null>(null);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshotResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadProgress() {
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
        setLoadError(error instanceof Error ? error.message : "Unable to load launch progress.");
      }
    }

    void loadProgress();

    return () => {
      isCancelled = true;
    };
  }, []);

  const quickbooksConnected = integrationHealth?.quickbooks.status === "connected";
  const excelPinned = integrationHealth?.microsoft.status === "connected" && !!integrationHealth?.workbook_binding;
  const firstReceiptCaptured = (summary?.total_receipts ?? 0) > 0;
  const firstSyncProven = (summary?.synced ?? 0) > 0;
  const paywallRequired = billingSnapshot?.entitlement.paywall_required ?? false;

  const steps: StepDefinition[] = [
    {
      key: "quickbooks",
      label: "Connect QuickBooks",
      detail: quickbooksConnected ? "Connected" : "Waiting on OAuth",
      href: "/settings/integrations",
      state: quickbooksConnected ? "complete" : "active",
    },
    {
      key: "excel",
      label: "Pin Excel table",
      detail: excelPinned ? "Workbook ready" : "Choose workbook",
      href: "/settings/integrations",
      state: excelPinned ? "complete" : quickbooksConnected ? "active" : "pending",
    },
    {
      key: "receipt",
      label: "Capture first receipt",
      detail: firstReceiptCaptured ? `${summary?.total_receipts ?? 0} captured` : "Still empty",
      href: "/receipts",
      state: firstReceiptCaptured ? "complete" : excelPinned ? "active" : "pending",
    },
    {
      key: "sync",
      label: "Prove first sync",
      detail: firstSyncProven ? `${summary?.synced ?? 0} synced` : "Need one clean post",
      href: "/reports",
      state: firstSyncProven ? "complete" : firstReceiptCaptured ? "active" : "pending",
    },
  ];

  const completedSteps = steps.filter((step) => step.state === "complete").length;
  const headline = paywallRequired
    ? "Billing is pausing new syncs until access is restored."
    : completedSteps === steps.length
      ? "The launch path is complete and the workflow has been proven."
      : `Launch progress: ${completedSteps} of ${steps.length} milestones are complete.`;
  const supportingCopy = paywallRequired
    ? "History remains visible, but recovery should be the next move."
    : loadError
      ? "Progress data is unavailable right now, so the setup state may be stale."
      : "Keep this ribbon honest so the owner always knows what still stands between setup and trust.";

  return (
    <section className="launch-progress-ribbon">
      <div className="launch-progress-header">
        <div>
          <p className="pane-label">Launch progress</p>
          <h2>{headline}</h2>
        </div>
        <p>{supportingCopy}</p>
      </div>
      <div className="launch-progress-steps">
        {steps.map((step, index) => (
          <Link key={step.key} href={step.href} className={`launch-progress-step is-${step.state}`}>
            <span className="launch-progress-index">{`0${index + 1}`}</span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

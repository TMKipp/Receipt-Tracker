"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getBillingSnapshot,
  getIntegrationHealth,
  getMonthlySpend,
  getReceiptSummary,
  type BillingSnapshotResponse,
  type IntegrationHealthResponse,
  type MonthlySpendResponse,
  type ReceiptSummaryResponse,
} from "@/lib/backend-api";
import { getDefaultDemoIdentity } from "@/lib/demo-identity";

const defaultDemoIdentity = getDefaultDemoIdentity();

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMoney(value: number | null, currency = "USD") {
  if (value === null) return "Pending";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedMoney(value: number | null, currency = "USD") {
  if (value === null) return "Pending";
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatMonthLabel(value: string) {
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01T00:00:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function shareOf(total: number | null, overall: number | null) {
  if (total === null || overall === null || overall <= 0) return 0;
  return Math.max(0, Math.min(1, total / overall));
}

export function ReportsWorkspace() {
  const [monthlySpend, setMonthlySpend] = useState<MonthlySpendResponse | null>(null);
  const [summary, setSummary] = useState<ReceiptSummaryResponse | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealthResponse | null>(null);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadReporting() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [spendResponse, summaryResponse, integrationResponse, billingResponse] = await Promise.all([
          getMonthlySpend(defaultDemoIdentity),
          getReceiptSummary(defaultDemoIdentity),
          getIntegrationHealth(defaultDemoIdentity),
          getBillingSnapshot(defaultDemoIdentity),
        ]);

        if (isCancelled) return;

        setMonthlySpend(spendResponse);
        setSummary(summaryResponse);
        setIntegrationHealth(integrationResponse);
        setBillingSnapshot(billingResponse);
      } catch (error) {
        if (isCancelled) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load reporting data.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadReporting();

    return () => {
      isCancelled = true;
    };
  }, []);

  const currentBucket = monthlySpend?.data[0] ?? null;
  const previousBucket = monthlySpend?.data[1] ?? null;
  const currentCurrency = currentBucket?.currency || "USD";
  const currentTotal = toNumber(currentBucket?.total);
  const previousTotal = toNumber(previousBucket?.total);
  const totalDelta = currentTotal !== null && previousTotal !== null ? currentTotal - previousTotal : null;
  const sortedCategories = currentBucket
    ? [...currentBucket.categories]
        .map((category) => ({
          ...category,
          numericTotal: toNumber(category.total),
        }))
        .sort((left, right) => (right.numericTotal ?? 0) - (left.numericTotal ?? 0))
    : [];
  const topCategory = sortedCategories[0] ?? null;
  const trialDaysRemaining = billingSnapshot?.entitlement.trial_days_remaining ?? null;

  const attentionItems = [
    summary?.review_required
      ? `${summary.review_required} receipts are still waiting for operator review before they can post.`
      : null,
    summary?.failed ? `${summary.failed} receipts need retry or manual support before books stay clean.` : null,
    topCategory && currentTotal && currentBucket
      ? `${topCategory.category_name} leads ${formatMonthLabel(currentBucket.month)} at ${Math.round(
          shareOf(topCategory.numericTotal, currentTotal) * 100,
        )}% of visible spend.`
      : null,
    trialDaysRemaining !== null && trialDaysRemaining <= 5
      ? `Trial access ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"}, so renewal messaging should stay visible.`
      : null,
    integrationHealth && integrationHealth.sync_ready_targets.length < 2
      ? "One or more sync targets still need connection work before the launch story feels complete."
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="workspace-stack">
      <section className="panel panel-emphasis">
        <div className="pane-heading">
          <div>
            <p className="pane-label">Operating pulse</p>
            <h2>Read the month like an owner, not a dashboard tourist.</h2>
          </div>
          <span>
            {currentBucket ? `Live reporting for ${formatMonthLabel(currentBucket.month)}` : "Waiting for report data"}
          </span>
        </div>
        <p className="section-intro">
          Reporting should explain where the money moved, what still needs attention, and whether the accounting path
          is trustworthy enough to close the week.
        </p>

        {loadError ? <div className="workspace-message workspace-message-error">{loadError}</div> : null}
        {isLoading ? <div className="workspace-message">Loading reporting from the backend...</div> : null}

        {!isLoading && !loadError ? (
          <div className="ops-kpi-grid">
            <article className="ops-kpi">
              <span>Month-to-date spend</span>
              <strong>{formatMoney(currentTotal, currentCurrency)}</strong>
              <p>{currentBucket ? formatMonthLabel(currentBucket.month) : "No monthly spend returned yet"}</p>
            </article>
            <article className="ops-kpi">
              <span>Receipts in system</span>
              <strong>{summary?.total_receipts ?? 0}</strong>
              <p>{summary?.review_required ?? 0} still require human review.</p>
            </article>
            <article className="ops-kpi">
              <span>Auto-approved</span>
              <strong>{summary?.auto_approved ?? 0}</strong>
              <p>Only receipts that clear the full trust policy skip the review lane.</p>
            </article>
            <article className="ops-kpi">
              <span>Trial runway</span>
              <strong>
                {trialDaysRemaining === null
                  ? billingSnapshot?.entitlement.active
                    ? "Paid"
                    : "Pending"
                  : `${trialDaysRemaining}d`}
              </strong>
              <p>
                {billingSnapshot?.entitlement.paywall_required
                  ? "New sync actions are gated until billing is restored."
                  : "Billing access is clear for active capture and sync."}
              </p>
            </article>
          </div>
        ) : null}
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Category mix</p>
              <h2>Where the spend is actually landing</h2>
            </div>
          </div>
          {sortedCategories.length > 0 && currentTotal ? (
            <div className="meter-list">
              {sortedCategories.map((category) => (
                <div key={`${currentBucket?.month}-${category.category_name}`} className="meter-row">
                  <div className="meter-copy">
                    <strong>{category.category_name}</strong>
                    <span>{formatMoney(category.numericTotal, currentCurrency)}</span>
                  </div>
                  <div className="meter-track" aria-hidden="true">
                    <div
                      className="meter-fill"
                      style={{ width: `${Math.max(8, shareOf(category.numericTotal, currentTotal) * 100)}%` }}
                    />
                  </div>
                  <small>{Math.round(shareOf(category.numericTotal, currentTotal) * 100)}% of visible spend</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="workspace-message">
              Monthly category totals will appear here once the backend returns spend history.
            </div>
          )}
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Month over month</p>
              <h2>Show the swing, then explain it.</h2>
            </div>
          </div>
          <div className="comparison-band">
            <div>
              <span>{currentBucket ? formatMonthLabel(currentBucket.month) : "Current month"}</span>
              <strong>{formatMoney(currentTotal, currentCurrency)}</strong>
            </div>
            <div>
              <span>{previousBucket ? formatMonthLabel(previousBucket.month) : "Previous month"}</span>
              <strong>{formatMoney(previousTotal, currentCurrency)}</strong>
            </div>
            <div>
              <span>Delta</span>
              <strong>{formatSignedMoney(totalDelta, currentCurrency)}</strong>
            </div>
          </div>
          <p className="section-note">
            Pairing the raw total change with category mix makes the report useful in five seconds instead of forcing
            the owner to infer why the number moved.
          </p>
        </article>
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Attention brief</p>
              <h2>What support or the owner should look at next</h2>
            </div>
          </div>
          <div className="insight-list">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => <p key={item}>{item}</p>)
            ) : (
              <p>Once live data is flowing, this brief will call out review pressure, sync risk, and billing timing.</p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Next actions</p>
              <h2>Keep reports connected to the operating lane</h2>
            </div>
          </div>
          <div className="detail-pairs">
            <div>
              <span>Review lane</span>
              <strong>{summary?.review_required ?? 0} waiting</strong>
            </div>
            <div>
              <span>Sync targets ready</span>
              <strong>{integrationHealth?.sync_ready_targets.length ?? 0} of 2</strong>
            </div>
            <div>
              <span>Workbook attached</span>
              <strong>{billingSnapshot?.workbook_binding ? "Yes" : "No"}</strong>
            </div>
          </div>
          <div className="action-link-row">
            <Link href="/receipts">Open receipt lane</Link>
            <Link href="/settings/integrations" className="secondary">
              Review sync posture
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}

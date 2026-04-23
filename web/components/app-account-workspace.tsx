"use client";

import { useEffect, useMemo, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ActionToastStack, type ActionToast } from "@/components/action-toast-stack";
import { MobileAppPreview } from "@/components/mobile-app-preview";
import { integrationHealth, launchChecklist } from "@/lib/mock-data";

type AccountPane = "readiness" | "billing" | "automation";

const accountPanes: Array<{ id: AccountPane; label: string }> = [
  { id: "readiness", label: "Readiness" },
  { id: "billing", label: "Billing" },
  { id: "automation", label: "Automation" },
];

function parsePane(value: string | null): AccountPane {
  if (value === "billing" || value === "automation") {
    return value;
  }

  return "readiness";
}

export function AppAccountWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pane, setPane] = useState<AccountPane>(() => parsePane(searchParams.get("pane")));
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(searchParams.get("autoApprove") === "on");
  const readinessChecks = launchChecklist;
  const [lastAction, setLastAction] = useState("First-sync posture remains healthy and trial billing still has 9 days of runway.");
  const [toasts, setToasts] = useState<ActionToast[]>([]);

  const readinessScore = useMemo(() => {
    const base = 84;
    return autoApproveEnabled ? base + 4 : base;
  }, [autoApproveEnabled]);

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function pushToast(title: string, detail: string, tone: ActionToast["tone"] = "neutral") {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, title, detail, tone }].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  useEffect(() => {
    const nextPane = parsePane(searchParams.get("pane"));
    const nextAutoApprove = searchParams.get("autoApprove") === "on";

    if (nextPane !== pane) {
      setPane(nextPane);
    }

    if (nextAutoApprove !== autoApproveEnabled) {
      setAutoApproveEnabled(nextAutoApprove);
    }
  }, [autoApproveEnabled, pane, searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (pane === "readiness") {
      params.delete("pane");
    } else {
      params.set("pane", pane);
    }

    if (autoApproveEnabled) {
      params.set("autoApprove", "on");
    } else {
      params.delete("autoApprove");
    }

    const next = params.toString();
    const current = searchParams.toString();

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [autoApproveEnabled, pane, pathname, router, searchParams]);

  const primaryActions = {
    reviewPaywall() {
      setPane("billing");
      setLastAction("The workspace shifted into billing so trial messaging and restore states stay visible.");
      pushToast("Billing view opened", "Trial copy and restore-access posture are now the active control surface.", "neutral");
    },
    restoreAccess() {
      setPane("billing");
      setLastAction("Restore-access posture is now front and center so churn recovery stays one tap away.");
      pushToast("Restore path highlighted", "The recovery flow is now the active account lens.", "warn");
    },
    testReadiness() {
      setPane("readiness");
      setLastAction("First-sync readiness ran cleanly across QuickBooks, Excel, and onboarding posture.");
      pushToast("Readiness test passed", "QuickBooks, Excel, and onboarding posture all look launch-ready.", "good");
    },
    toggleAutoApprove() {
      const nextValue = !autoApproveEnabled;
      setAutoApproveEnabled(nextValue);
      setPane("automation");
      setLastAction(
        nextValue
          ? "Auto-approve moved on, but only behind mapped accounts and confidence thresholds."
          : "Auto-approve returned to review-first mode so the owner keeps every trust decision in sight.",
      );
      pushToast(
        nextValue ? "Auto-approve enabled" : "Auto-approve disabled",
        nextValue
          ? "Automation policy is live, but still gated by approval thresholds and mapping rules."
          : "The workspace returned to full first-pass owner review.",
        nextValue ? "good" : "warn",
      );
    },
  };

  const paneNarrative =
    pane === "billing"
      ? {
          title: "Billing and restore flows are part of trust, not an afterthought.",
          detail: "Trial runway, restore access, and customer recovery need to feel like product features, not support side quests.",
        }
      : pane === "automation"
        ? {
            title: "Automation is only useful when its guardrails stay legible.",
            detail: "Auto-approve, category memory, and sync retries should show the owner exactly what is happening and why.",
          }
        : {
            title: "Launch readiness should read like one coherent operating picture.",
            detail: "Billing, integrations, onboarding, and failure recovery need to point toward the same first successful sync.",
          };

  return (
    <div className="app-workspace-grid">
      <section className="app-workspace-main">
        <div className="app-surface-header">
          <div>
            <p className="pane-label">Account</p>
            <h2>Manage billing, integrations, and automation</h2>
            <p>Keep this screen simple: what is healthy, what needs attention, and what will happen if you change a setting.</p>
          </div>
          <span className={`status-pill ${autoApproveEnabled ? "status-good" : "status-neutral"}`}>
            {autoApproveEnabled ? "Automation assisted" : "Trial active"}
          </span>
        </div>

        <div className="app-report-toolbar">
          <div className="app-filter-chips" role="tablist" aria-label="Account sections">
            {accountPanes.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === pane ? "is-active" : undefined}
                onClick={() => {
                  setPane(entry.id);
                  pushToast("Account lens updated", `${entry.label} is now the active control surface.`, "neutral");
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div className="app-inline-summary">
            <span>Launch readiness score: {readinessScore}%</span>
            <small>{autoApproveEnabled ? "Automation is now guarded and active" : "Owner review still controls every first-pass decision"}</small>
          </div>
        </div>

        <div className="app-account-hero">
          <div>
            <span className="pane-label">Primary workspace</span>
            <h3>Atlas Property Services</h3>
            <p>{paneNarrative.detail}</p>
          </div>
          <div className="app-account-hero-meta">
            <span>{pane === "billing" ? "Trial runway" : pane === "automation" ? "Automation policy" : "Readiness score"}</span>
            <strong>{pane === "billing" ? "9 days left" : pane === "automation" ? (autoApproveEnabled ? "Guarded on" : "Review first") : `${readinessScore}%`}</strong>
          </div>
        </div>

        <div className="app-account-grid">
          <article>
            <span>QuickBooks</span>
            <strong>Connected</strong>
            <p>Chart of accounts imported and expense sync lane staged.</p>
          </article>
          <article>
            <span>Excel</span>
            <strong>Workbook pinned</strong>
            <p>`Expenses_2026` remains the live table for row appends.</p>
          </article>
          <article>
            <span>Auto-approve</span>
            <strong>{autoApproveEnabled ? "Guardrails active" : "Off until onboarding completes"}</strong>
            <p>{autoApproveEnabled ? "Confidence, duplicate clear, and mapped account rules still gate posting." : "The owner still sees every first-pass trust decision."}</p>
          </article>
        </div>

        <div className="app-account-actions">
          <button type="button" onClick={primaryActions.reviewPaywall}>
            Review paywall messaging
          </button>
          <button type="button" onClick={primaryActions.restoreAccess}>
            Open restore-access flow
          </button>
          <button type="button" onClick={primaryActions.testReadiness}>
            Test first-sync readiness
          </button>
          <button type="button" onClick={primaryActions.toggleAutoApprove}>
            {autoApproveEnabled ? "Return to review-first" : "Enable guarded auto-approve"}
          </button>
        </div>

        <div className="app-account-lower">
          <div className="app-checklist-panel">
            <div className="app-checklist-header">
              <div>
                <span className="pane-label">{pane === "billing" ? "Billing posture" : pane === "automation" ? "Automation policy" : "Launch checklist"}</span>
                <h3>{pane === "billing" ? "Commercial readiness" : pane === "automation" ? "Automation trust rails" : "Commercial readiness"}</h3>
              </div>
              <strong>{pane === "billing" ? "Trial intact" : pane === "automation" ? (autoApproveEnabled ? "Guarded on" : "Review-first") : `${readinessChecks.length} items live`}</strong>
            </div>
            <div className="app-checklist-list">
              {(pane === "billing"
                ? [
                    "14-day trial messaging still aligns with first-sync promise",
                    "Restore-access path is visible before the paywall becomes a blocker",
                    "Customer recovery copy stays inside the signed-in product, not just email",
                  ]
                : pane === "automation"
                  ? [
                      "Auto-approve still requires mapped accounts and prior vendor trust",
                      "Duplicate guard remains visible before anything posts automatically",
                      "Retry logic stays legible instead of hiding background sync behavior",
                    ]
                  : readinessChecks
              ).map((item) => (
                <article key={item}>
                  <span>{pane === "billing" ? "Live" : pane === "automation" ? "Guardrail" : "Ready"}</span>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="app-health-panel">
            <div className="app-checklist-header">
              <div>
                <span className="pane-label">{pane === "billing" ? "Revenue posture" : "Integration posture"}</span>
                <h3>{pane === "billing" ? "What the customer should feel" : "What the owner can trust"}</h3>
              </div>
            </div>
            <div className="app-health-list">
              <article>
                <span>QuickBooks</span>
                <strong>{integrationHealth.quickbooks.status}</strong>
                <p>{integrationHealth.quickbooks.detail}</p>
              </article>
              <article>
                <span>Excel</span>
                <strong>{integrationHealth.excel.status}</strong>
                <p>{integrationHealth.excel.detail}</p>
              </article>
              <article>
                <span>Last control action</span>
                <strong>{pane === "billing" ? "Recovery visible" : pane === "automation" ? "Automation explained" : "Launch path clear"}</strong>
                <p>{lastAction}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <aside className="app-workspace-side">
        <div className="app-mobile-mirror">
          <div className="app-mobile-mirror-header">
            <div>
              <span className="pane-label">Phone mirror</span>
              <strong>{pane === "automation" ? "Automation posture on mobile" : pane === "billing" ? "Billing posture on mobile" : "Readiness on mobile"}</strong>
            </div>
            <small>{pane === "automation" ? "Guardrails active" : pane === "billing" ? "Trial visible" : "Launch score live"}</small>
          </div>
          <MobileAppPreview mode={pane === "automation" ? "review" : "queue"} />
        </div>
        <div className="app-side-note">
          <span className="pane-label">Simple rule</span>
          <p>Every setting should make it obvious what is healthy now and what will change next.</p>
        </div>
      </aside>
      <ActionToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

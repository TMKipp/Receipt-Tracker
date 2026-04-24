"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ActionToastStack, type ActionToast } from "@/components/action-toast-stack";
import { receipts as initialReceipts, type CommercialReceipt } from "@/lib/mock-data";

type ReceiptFilterId = "review" | "ready" | "failed" | "high-confidence";

const filterDefinitions: Array<{ id: ReceiptFilterId; label: string }> = [
  { id: "review", label: "Needs review" },
  { id: "ready", label: "Ready to sync" },
  { id: "failed", label: "Failed syncs" },
  { id: "high-confidence", label: "High confidence" },
];

const initialActivity = [
  { title: "QuickBooks attachment queued", detail: "Staples Chelsea will attach after approval." },
  { title: "Excel row shape validated", detail: "Expenses_2026 columns still match the sync contract." },
  { title: "Duplicate guard stayed clear", detail: "No recent receipt matched vendor and amount." },
];

const validFilterIds = new Set<ReceiptFilterId>(["review", "ready", "failed", "high-confidence"]);

function parseFilter(value: string | null): ReceiptFilterId {
  if (value && validFilterIds.has(value as ReceiptFilterId)) {
    return value as ReceiptFilterId;
  }

  return "review";
}

function matchesFilter(receipt: CommercialReceipt, filterId: ReceiptFilterId) {
  switch (filterId) {
    case "review":
      return receipt.status === "review_required";
    case "ready":
      return receipt.quickbooks === "ready" || receipt.excel === "ready" || receipt.status === "approved";
    case "failed":
      return receipt.status === "failed" || receipt.quickbooks === "failed" || receipt.excel === "failed";
    case "high-confidence":
      return receipt.confidence >= 0.95;
    default:
      return true;
  }
}

function matchesQuery(receipt: CommercialReceipt, query: string) {
  if (!query.trim()) {
    return true;
  }

  const search = query.trim().toLowerCase();
  return [receipt.vendor, receipt.amount, receipt.category, receipt.status].some((value) =>
    value.toLowerCase().includes(search),
  );
}

function formatStatusLabel(status: CommercialReceipt["status"]) {
  return status.replace("_", " ");
}

function buildReviewHeadline(receipt: CommercialReceipt) {
  if (receipt.status === "review_required") {
    return "Check the key fields, then approve it.";
  }

  if (receipt.status === "syncing") {
    return "This receipt is already moving through sync.";
  }

  if (receipt.status === "approved") {
    return "This receipt is approved and waiting to finish posting.";
  }

  return "This receipt needs attention before it can move forward.";
}

function buildKeyFields(receipt: CommercialReceipt) {
  return [
    { label: "Date", value: receipt.date },
    { label: "Category", value: receipt.category },
    { label: "Confidence", value: `${Math.round(receipt.confidence * 100)}%` },
    { label: "Sync", value: receipt.quickbooks === "failed" || receipt.excel === "failed" ? "Needs attention" : "Ready" },
  ];
}

function buildApprovalChecklist(receipt: CommercialReceipt) {
  return [
    {
      label: "Vendor and total look right",
      value: `${receipt.vendor} | ${receipt.amount}`,
      tone: "good" as const,
    },
    {
      label: "Category is mapped",
      value: receipt.category,
      tone: "good" as const,
    },
    {
      label: "Duplicate guard",
      value: receipt.duplicateClear ? "Clear" : "Possible duplicate",
      tone: receipt.duplicateClear ? ("good" as const) : ("warn" as const),
    },
    {
      label: "Sync targets",
      value:
        receipt.quickbooks === "failed" || receipt.excel === "failed"
          ? "One target needs attention"
          : "QuickBooks and Excel ready",
      tone: receipt.quickbooks === "failed" || receipt.excel === "failed" ? ("warn" as const) : ("good" as const),
    },
  ];
}

export function AppInboxWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [receiptState, setReceiptState] = useState(initialReceipts);
  const [selectedReceiptId, setSelectedReceiptId] = useState(searchParams.get("receipt") ?? initialReceipts[0]?.id ?? "");
  const [activeFilter, setActiveFilter] = useState<ReceiptFilterId>(() => parseFilter(searchParams.get("filter")));
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activity, setActivity] = useState(initialActivity);
  const [toasts, setToasts] = useState<ActionToast[]>([]);

  const deferredQuery = useDeferredValue(query);
  const filteredReceipts = useMemo(
    () => receiptState.filter((receipt) => matchesFilter(receipt, activeFilter) && matchesQuery(receipt, deferredQuery)),
    [activeFilter, deferredQuery, receiptState],
  );
  const selectedReceipt = filteredReceipts.find((receipt) => receipt.id === selectedReceiptId) ?? filteredReceipts[0] ?? null;

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

  function pushActivity(title: string, detail: string) {
    setActivity((current) => [{ title, detail }, ...current].slice(0, 4));
  }

  useEffect(() => {
    const nextFilter = parseFilter(searchParams.get("filter"));
    const nextQuery = searchParams.get("q") ?? "";
    const nextReceipt = searchParams.get("receipt") ?? "";

    if (nextFilter !== activeFilter) {
      setActiveFilter(nextFilter);
    }

    if (nextQuery !== query) {
      setQuery(nextQuery);
    }

    if (nextReceipt && nextReceipt !== selectedReceiptId) {
      setSelectedReceiptId(nextReceipt);
    }
  }, [activeFilter, query, searchParams, selectedReceiptId]);

  useEffect(() => {
    if (!selectedReceipt && filteredReceipts[0]) {
      setSelectedReceiptId(filteredReceipts[0].id);
    }
  }, [filteredReceipts, selectedReceipt]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (activeFilter === "review") {
      params.delete("filter");
    } else {
      params.set("filter", activeFilter);
    }

    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }

    const targetReceiptId = selectedReceipt?.id ?? selectedReceiptId;
    if (targetReceiptId) {
      params.set("receipt", targetReceiptId);
    } else {
      params.delete("receipt");
    }

    const next = params.toString();
    const current = searchParams.toString();

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [activeFilter, pathname, query, router, searchParams, selectedReceipt?.id, selectedReceiptId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (!filteredReceipts.length) {
        return;
      }

      const currentIndex = filteredReceipts.findIndex((receipt) => receipt.id === selectedReceipt?.id);
      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, filteredReceipts.length - 1);
        setSelectedReceiptId(filteredReceipts[nextIndex].id);
        return;
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        setSelectedReceiptId(filteredReceipts[nextIndex].id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredReceipts, selectedReceipt]);

  function handleApproveNow() {
    if (!selectedReceipt) {
      return;
    }

    setReceiptState((current) =>
      current.map((receipt) =>
        receipt.id === selectedReceipt.id
          ? {
              ...receipt,
              status: "approved",
              quickbooks: "queued",
              excel: "queued",
            }
          : receipt,
      ),
    );
    pushActivity("Receipt approved", `${selectedReceipt.vendor} is queued for QuickBooks and Excel sync.`);
    pushToast("Receipt approved", `${selectedReceipt.vendor} will sync next.`, "good");
  }

  function handleHoldForEdit() {
    if (!selectedReceipt) {
      return;
    }

    pushActivity("Receipt held for edit", `${selectedReceipt.vendor} stayed in review for a manual check.`);
    pushToast("Needs changes", `${selectedReceipt.vendor} stayed in review.`, "warn");
  }

  function handleRetryBackground() {
    if (!selectedReceipt) {
      return;
    }

    setReceiptState((current) =>
      current.map((receipt) =>
        receipt.id === selectedReceipt.id
          ? {
              ...receipt,
              status: "syncing",
              quickbooks: "queued",
              excel: "queued",
            }
          : receipt,
      ),
    );
    pushActivity("Sync retry started", `${selectedReceipt.vendor} is retrying the sync path now.`);
    pushToast("Retry started", `${selectedReceipt.vendor} is moving through the queue again.`, "neutral");
  }

  if (!selectedReceipt) {
    return (
      <div className="app-empty-state">
        <span className="pane-label">Inbox</span>
        <h2>No receipts match this view</h2>
        <p>Try a different filter or clear the current search to bring receipts back into the review lane.</p>
        <div className="app-empty-actions">
          <button
            type="button"
            onClick={() => {
              setActiveFilter("review");
              setQuery("");
            }}
          >
            Reset inbox view
          </button>
        </div>
        <ActionToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="app-review-workspace app-review-workspace-simple">
      <section className="app-inbox-intro">
        <div>
          <span className="pane-label">Inbox</span>
          <h2>Pick the next receipt and clear it in one pass.</h2>
          <p>Start with the queue, confirm the key fields, then approve it or hold it for edits.</p>
        </div>
        <div className="app-inbox-meta">
          <article>
            <span>Waiting</span>
            <strong>{filteredReceipts.length}</strong>
          </article>
          <article>
            <span>Selected</span>
            <strong>{selectedReceipt.vendor}</strong>
          </article>
          <article>
            <span>Rule</span>
            <strong>Vendor, date, total, category</strong>
          </article>
        </div>
      </section>

      <div className="app-review-workbench app-review-workbench-simple">
        <section className="app-selection-panel app-selection-panel-simple">
          <div className="app-selection-header">
            <div>
              <span className="pane-label">Queue</span>
              <h3>Choose the next receipt</h3>
              <p>Start with the receipt already waiting for review.</p>
            </div>
            <span className="status-pill status-warn">{filteredReceipts.length} waiting</span>
          </div>

          <label className="app-search-shell">
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => {
                const nextValue = event.target.value;
                startTransition(() => {
                  setQuery(nextValue);
                });
              }}
              placeholder="Search vendor, amount, or category"
              aria-label="Search receipts"
            />
            <strong>/</strong>
          </label>

          <div className="app-filter-chips" role="tablist" aria-label="Inbox filters">
            {filterDefinitions.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={filter.id === activeFilter ? "is-active" : undefined}
                onClick={() => {
                  startTransition(() => {
                    setActiveFilter(filter.id);
                  });
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="app-selection-list">
            {filteredReceipts.map((receipt) => (
              <button
                key={receipt.id}
                type="button"
                className={`app-selection-item ${receipt.id === selectedReceipt.id ? "is-selected" : ""}`.trim()}
                onClick={() => {
                  setSelectedReceiptId(receipt.id);
                  if (receipt.id !== selectedReceipt.id) {
                    pushActivity("Selection changed", `${receipt.vendor} is now open in review.`);
                  }
                }}
              >
                <div className="app-selection-item-copy">
                  <strong>{receipt.vendor}</strong>
                  <small>{receipt.date}</small>
                </div>
                <div className="app-selection-item-meta">
                  <span>{receipt.amount}</span>
                  <small>{receipt.category}</small>
                </div>
              </button>
            ))}
          </div>

          <div className="app-selection-activity">
            <span className="pane-label">Recent activity</span>
            <div className="app-review-footer-list">
              {activity.slice(0, 3).map((item) => (
                <article key={`${item.title}-${item.detail}`}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="app-review-stage app-review-stage-simple">
          <div className="app-review-stage-header">
            <div>
              <span className="pane-label">Review</span>
              <h3>{selectedReceipt.vendor}</h3>
              <p>{buildReviewHeadline(selectedReceipt)}</p>
            </div>
            <span className="status-pill status-neutral">{formatStatusLabel(selectedReceipt.status)}</span>
          </div>

          <div className="app-review-hero app-review-hero-simple">
            <div className="app-review-hero-copy">
              <span className="pane-label">Selected receipt</span>
              <h2>{selectedReceipt.vendor}</h2>
              <p>{selectedReceipt.notes}</p>
            </div>
            <div className="app-review-hero-total">
              <span>Total</span>
              <strong>{selectedReceipt.amount}</strong>
              <small>{selectedReceipt.date}</small>
            </div>
          </div>

          <div className="app-review-focus-grid">
            <section className="app-review-card app-review-card-soft">
              <span className="pane-label">Key fields</span>
              <div className="app-review-detail-list">
                {buildKeyFields(selectedReceipt).map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="app-review-card app-review-card-soft">
              <span className="pane-label">Checks before approval</span>
              <div className="app-review-detail-list">
                {buildApprovalChecklist(selectedReceipt).map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong className={item.tone === "warn" ? "app-value-warn" : undefined}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="app-review-card app-review-card-soft">
            <span className="pane-label">Why this looks ready</span>
            <div className="app-review-story-list">
              {selectedReceipt.decisionSummary.map((item) => (
                <article key={item}>
                  <span aria-hidden="true" />
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="app-review-card app-review-card-soft">
            <span className="pane-label">Line items</span>
            <div className="app-review-detail-list">
              {selectedReceipt.lineItems.map((item) => (
                <div key={item.name}>
                  <span>
                    {item.name} x {item.qty}
                  </span>
                  <strong>{item.amount}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="app-sync-panel app-sync-panel-simple">
            <div className="app-sync-panel-grid">
              <article>
                <span>QuickBooks</span>
                <strong>{selectedReceipt.quickbooks === "synced" ? "Already posted" : "Will create expense"}</strong>
                <p>The approved values become one expense record.</p>
              </article>
              <article>
                <span>Excel</span>
                <strong>{selectedReceipt.excel === "synced" ? "Already appended" : "Will append row"}</strong>
                <p>The same approved values are added to the workbook table.</p>
              </article>
              <article>
                <span>Receipt image</span>
                <strong>Always kept</strong>
                <p>The original image stays attached for audit and recovery.</p>
              </article>
            </div>
          </section>

          <div className="app-primary-actions app-primary-actions-bar">
            <button type="button" onClick={handleApproveNow}>
              Approve and sync
            </button>
            <button type="button" onClick={handleHoldForEdit}>
              Needs changes
            </button>
            <button type="button" onClick={handleRetryBackground}>
              Retry sync
            </button>
            <button type="button">View image</button>
          </div>
        </section>
      </div>

      <ActionToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

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
    return "Check the extracted fields and approve when they look right.";
  }

  if (receipt.status === "syncing") {
    return "This receipt is already moving through the sync path.";
  }

  if (receipt.status === "approved") {
    return "Approved receipts wait here until the books finish updating.";
  }

  return "This receipt stays visible until the books are safe.";
}

function buildReceiptSummary(receipt: CommercialReceipt) {
  return [
    { label: "Vendor", value: receipt.vendor },
    { label: "Date", value: receipt.date },
    { label: "Category", value: receipt.category },
    { label: "Confidence", value: `${Math.round(receipt.confidence * 100)}%` },
  ];
}

function buildApprovalChecklist(receipt: CommercialReceipt) {
  return [
    {
      label: "Vendor and category",
      value: `${receipt.vendor} | ${receipt.category}`,
      tone: "good" as const,
    },
    {
      label: "Date and total",
      value: `${receipt.date} | ${receipt.amount}`,
      tone: receipt.confidence >= 0.95 ? ("good" as const) : ("warn" as const),
    },
    {
      label: "Duplicate check",
      value: receipt.duplicateClear ? "No recent match found" : "Possible duplicate detected",
      tone: receipt.duplicateClear ? ("good" as const) : ("warn" as const),
    },
    {
      label: "Sync targets",
      value: `${receipt.quickbooks === "failed" ? "QB needs attention" : "QB ready"} | ${
        receipt.excel === "failed" ? "Excel needs attention" : "Excel ready"
      }`,
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
        return;
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
    <div className="app-review-workspace">
      <section className="app-next-step-strip">
        <div className="app-next-step-copy">
          <span className="pane-label">Start here</span>
          <h2>Review the next receipt and approve it when the 4 key fields look right.</h2>
          <p>Most receipts only need one quick check: vendor, date, total, and category.</p>
        </div>
        <div className="app-next-step-kpis">
          <article>
            <span>In review</span>
            <strong>{filteredReceipts.length}</strong>
          </article>
          <article>
            <span>Selected</span>
            <strong>{selectedReceipt.vendor}</strong>
          </article>
          <article>
            <span>Next action</span>
            <strong>{selectedReceipt.status === "review_required" ? "Approve or edit" : "Watch sync"}</strong>
          </article>
        </div>
      </section>

      <div className="app-review-workbench">
        <section className="app-selection-panel">
          <div className="app-selection-header">
            <div>
              <span className="pane-label">Queue</span>
              <h3>Choose the next receipt</h3>
              <p>Start with the next item waiting for review.</p>
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
                  <small>
                    {receipt.category} | {receipt.date}
                  </small>
                </div>
                <div className="app-selection-item-meta">
                  <span>{receipt.amount}</span>
                  <small>{formatStatusLabel(receipt.status)}</small>
                </div>
              </button>
            ))}
          </div>

          <div className="app-selection-help">
            <span>Shortcuts</span>
            <p>`/` search, `J/K` move through the queue.</p>
          </div>
        </section>

        <section className="app-review-stage">
          <div className="app-review-stage-header">
            <div>
              <span className="pane-label">Review</span>
              <h3>Confirm the important fields</h3>
              <p>{buildReviewHeadline(selectedReceipt)}</p>
            </div>
            <span className="status-pill status-neutral">Receipt {selectedReceipt.id}</span>
          </div>

          <div className="app-review-hero">
            <div className="app-review-hero-copy">
              <span className="pane-label">Selected receipt</span>
              <h2>{selectedReceipt.vendor}</h2>
              <p>{selectedReceipt.notes}</p>
            </div>
            <div className="app-review-hero-total">
              <span>Total</span>
              <strong>{selectedReceipt.amount}</strong>
              <small>{formatStatusLabel(selectedReceipt.status)}</small>
            </div>
          </div>

          <div className="app-review-summary-grid">
            {buildReceiptSummary(selectedReceipt).map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="app-review-details-grid">
            <section className="app-review-card">
              <span className="pane-label">Before you approve</span>
              <div className="app-review-detail-list">
                {buildApprovalChecklist(selectedReceipt).map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong className={item.tone === "warn" ? "app-value-warn" : undefined}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="app-review-card">
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
          </div>

          <section className="app-review-card app-line-items-card">
            <span className="pane-label">Receipt lines</span>
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

          <section className="app-sync-panel">
            <div className="app-sync-panel-header">
              <div>
                <span className="pane-label">Approve</span>
                <h3>What happens after you approve</h3>
              </div>
              <span className="status-pill status-good">One approved payload</span>
            </div>
            <div className="app-sync-panel-grid">
              <article>
                <span>QuickBooks</span>
                <strong>{selectedReceipt.quickbooks === "synced" ? "Already posted" : "Create expense"}</strong>
                <p>The approved values will become one expense record.</p>
              </article>
              <article>
                <span>Excel</span>
                <strong>{selectedReceipt.excel === "synced" ? "Already appended" : "Append row"}</strong>
                <p>The same approved values will be appended to the workbook table.</p>
              </article>
              <article>
                <span>Receipt image</span>
                <strong>Keep the source</strong>
                <p>The image stays attached so recovery is simple if something fails later.</p>
              </article>
            </div>
          </section>

          <div className="app-primary-actions">
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

      <section className="app-review-footer">
        <div className="app-review-footer-card">
          <span className="pane-label">Recent system activity</span>
          <div className="app-review-footer-list">
            {activity.slice(0, 3).map((item) => (
              <article key={`${item.title}-${item.detail}`}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="app-review-footer-card">
          <span className="pane-label">Simple rule</span>
          <h3>Approve only when the key fields look right.</h3>
          <p>If something feels wrong, choose <strong>Needs changes</strong> and keep the books clean.</p>
        </div>
      </section>

      <ActionToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

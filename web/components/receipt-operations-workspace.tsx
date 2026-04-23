"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";

import {
  type ApiReceipt,
  approveReceipt,
  getReceipt,
  getReceiptSummary,
  listReceipts,
  retryReceiptProcessing,
  syncReceipt,
} from "@/lib/backend-api";

const statusFilters = [
  { value: "all", label: "All receipts" },
  { value: "review_required", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "syncing", label: "Syncing" },
  { value: "synced", label: "Synced" },
  { value: "failed", label: "Failed" },
] as const;

type LiveReceiptSummary = {
  receiptId: string;
  status: string;
  merchantName: string | null;
  categoryName: string | null;
  total: string | null;
  overallConfidence: string | null;
  decisionSummary: string[];
  processingError: string | null;
};

type ReceiptSummary = {
  total_receipts: number;
  review_required: number;
  processing: number;
  synced: number;
  failed: number;
  auto_approved: number;
};

function dateLabel(value: string | null) {
  if (!value) return "Pending date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

function moneyLabel(receipt: ApiReceipt) {
  if (!receipt.total) return "Pending total";
  const numeric = Number(receipt.total);
  if (Number.isNaN(numeric)) return receipt.total;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: receipt.currency || "USD",
  }).format(numeric);
}

function labelForStatus(status: string) {
  switch (status) {
    case "review_required":
      return "Needs review";
    case "approved":
      return "Approved";
    case "processing":
      return "Processing";
    case "syncing":
      return "Syncing";
    case "synced":
      return "Synced";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function labelForSyncState(state: ApiReceipt["sync_targets"]["quickbooks"]) {
  switch (state) {
    case "not_connected":
      return "Not connected";
    case "not_requested":
      return "Ready";
    case "queued":
      return "Queued";
    case "syncing":
      return "Syncing";
    case "synced":
      return "Synced";
    case "failed":
      return "Failed";
    default:
      return state;
  }
}

function statusToneClass(status: string) {
  switch (status) {
    case "approved":
    case "synced":
      return "status-good";
    case "review_required":
      return "status-warn";
    case "processing":
    case "syncing":
      return "status-neutral";
    case "failed":
      return "status-bad";
    default:
      return "status-neutral";
  }
}

function syncToneClass(state: ApiReceipt["sync_targets"]["quickbooks"]) {
  switch (state) {
    case "synced":
      return "status-good";
    case "queued":
    case "syncing":
      return "status-warn";
    case "failed":
      return "status-bad";
    case "not_connected":
      return "status-neutral";
    case "not_requested":
      return "status-neutral";
    default:
      return "status-neutral";
  }
}

function confidenceLabel(receipt: ApiReceipt) {
  if (!receipt.overall_confidence) return "Pending";
  const numeric = Number(receipt.overall_confidence);
  if (Number.isNaN(numeric)) return receipt.overall_confidence;
  return `${Math.round(numeric * 100)}%`;
}

function mergeReceipt(receipts: ApiReceipt[], nextReceipt: ApiReceipt) {
  const otherReceipts = receipts.filter((receipt) => receipt.id !== nextReceipt.id);
  return [nextReceipt, ...otherReceipts];
}

export function ReceiptOperationsWorkspace() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]["value"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState(
    process.env.NEXT_PUBLIC_RECEIPT_API_BASE_URL || "http://localhost:8000/api/v1",
  );
  const [demoEmail, setDemoEmail] = useState("demo@example.com");
  const [demoName, setDemoName] = useState("Demo User");
  const [captureNotes, setCaptureNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("Choose a receipt photo to run the live extraction path.");
  const [liveReceipt, setLiveReceipt] = useState<LiveReceiptSummary | null>(null);
  const [receipts, setReceipts] = useState<ApiReceipt[]>([]);
  const [summary, setSummary] = useState<ReceiptSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activityMessage, setActivityMessage] = useState("Backend-driven inbox is ready.");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredSearch = useDeferredValue(search);

  const identity = {
    backendUrl,
    demoEmail,
    demoName,
  };

  useEffect(() => {
    let isCancelled = false;

    async function loadInbox() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [receiptList, receiptSummary] = await Promise.all([
          listReceipts(identity, {
            status: statusFilter,
            q: deferredSearch,
            limit: 50,
          }),
          getReceiptSummary(identity),
        ]);

        if (isCancelled) {
          return;
        }

        setReceipts(receiptList.data);
        setSummary(receiptSummary);

        if (receiptList.data.length === 0) {
          setSelectedId(null);
        } else {
          setSelectedId((current) => {
            if (current && receiptList.data.some((receipt) => receipt.id === current)) {
              return current;
            }
            return receiptList.data[0].id;
          });
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Unable to load receipts from the backend.");
        setReceipts([]);
        setSummary(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInbox();

    return () => {
      isCancelled = true;
    };
  }, [backendUrl, deferredSearch, demoEmail, demoName, refreshKey, statusFilter]);

  const activeReceipt = receipts.find((receipt) => receipt.id === selectedId) ?? receipts[0] ?? null;

  async function refreshActiveReceipt(receiptId: string, message: string) {
    const refreshed = await getReceipt(identity, receiptId);
    setReceipts((current) => mergeReceipt(current, refreshed));
    setSelectedId(refreshed.id);
    setActivityMessage(message);
    setRefreshKey((current) => current + 1);
  }

  async function uploadLiveReceipt() {
    if (!selectedFile) {
      setUploadMessage("Select a receipt image before starting the live capture flow.");
      return;
    }

    setIsUploading(true);
    setUploadMessage("Requesting an upload target from the backend...");
    setLiveReceipt(null);

    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Demo-User-Email": demoEmail,
        "X-Demo-User-Name": demoName,
      };

      const presignResponse = await fetch(`${backendUrl}/uploads/receipts/presign`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filename: selectedFile.name,
          mime_type: selectedFile.type || "image/jpeg",
          size_bytes: selectedFile.size,
        }),
      });
      if (!presignResponse.ok) {
        throw new Error(await presignResponse.text());
      }
      const presign = await presignResponse.json();

      setUploadMessage("Uploading receipt image...");
      const uploadResponse = await fetch(presign.upload_url, {
        method: "PUT",
        headers: presign.headers,
        body: selectedFile,
      });
      if (!uploadResponse.ok) {
        throw new Error(await uploadResponse.text());
      }

      setUploadMessage("Creating receipt record...");
      const createResponse = await fetch(`${backendUrl}/receipts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          file: {
            object_key: presign.object_key,
            mime_type: selectedFile.type || "image/jpeg",
            original_filename: selectedFile.name,
          },
          source: "upload",
          notes: captureNotes || undefined,
        }),
      });
      if (!createResponse.ok) {
        throw new Error(await createResponse.text());
      }
      const createdReceipt = await createResponse.json();

      setUploadMessage("Running OCR and normalization...");
      const processResponse = await fetch(`${backendUrl}/receipts/${createdReceipt.id}/upload-complete`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          file_size_bytes: selectedFile.size,
        }),
      });
      if (!processResponse.ok) {
        throw new Error(await processResponse.text());
      }

      const detail = await getReceipt(identity, createdReceipt.id);

      setLiveReceipt({
        receiptId: detail.id,
        status: detail.status,
        merchantName: detail.merchant_name,
        categoryName: detail.category_name,
        total: detail.total,
        overallConfidence: detail.overall_confidence,
        decisionSummary: detail.decision?.decision_summary ?? [],
        processingError: detail.processing_error,
      });
      setReceipts((current) => mergeReceipt(current, detail));
      setSelectedId(detail.id);
      setRefreshKey((current) => current + 1);
      setUploadMessage("Live extraction completed. Review the detected fields below.");
      setActivityMessage("A new receipt was captured and added to the inbox.");
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "The live capture flow failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleApprove() {
    if (!activeReceipt) return;
    setActiveAction(`approve:${activeReceipt.id}`);
    try {
      const updated = await approveReceipt(identity, activeReceipt.id);
      setReceipts((current) => mergeReceipt(current, updated));
      setSelectedId(updated.id);
      setActivityMessage("Receipt approved. It is ready for sync.");
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRetryProcessing() {
    if (!activeReceipt) return;
    setActiveAction(`retry:${activeReceipt.id}`);
    try {
      await retryReceiptProcessing(identity, activeReceipt.id);
      await refreshActiveReceipt(activeReceipt.id, "Processing retried. Refreshed receipt details from the backend.");
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : "Retry failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSync(target: "quickbooks" | "excel") {
    if (!activeReceipt) return;
    setActiveAction(`sync:${target}:${activeReceipt.id}`);
    try {
      await syncReceipt(identity, activeReceipt.id, [target]);
      await refreshActiveReceipt(activeReceipt.id, `${target === "quickbooks" ? "QuickBooks" : "Excel"} sync requested.`);
    } catch (error) {
      setActivityMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRefresh() {
    setActivityMessage("Refreshing inbox from the backend...");
    setRefreshKey((current) => current + 1);
  }

  const canApprove = !!activeReceipt && !activeReceipt.approved_at && activeReceipt.status !== "processing";
  const canRetry = !!activeReceipt && activeReceipt.status === "failed";
  const canSync = !!activeReceipt && !!activeReceipt.approved_at;
  const queueHeadline = summary
    ? summary.review_required > 0
      ? `${summary.review_required} receipts still need human review.`
      : "The review lane is currently under control."
    : "Queue health appears here once the backend responds.";
  const queueGuidance = activeReceipt
    ? activeReceipt.status === "review_required"
      ? `Start with ${activeReceipt.merchant_name || "the selected receipt"} and clear the trust decision before posting.`
      : activeReceipt.status === "failed"
        ? `The selected receipt needs recovery before it can move forward.`
        : `The selected receipt is already moving through the accounting path.`
    : "Select a receipt to see the next best action.";

  return (
    <div className="workspace-stack">
      <section className="live-capture-panel">
        <div className="pane-heading">
          <div>
            <p className="pane-label">Live capture lane</p>
            <h2>Run a real receipt through the backend</h2>
          </div>
          <span>Uses the local demo user headers by default</span>
        </div>
        <div className="live-capture-grid">
          <label className="search-field">
            <span>Backend API base</span>
            <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
          </label>
          <label className="search-field">
            <span>Demo email</span>
            <input value={demoEmail} onChange={(event) => setDemoEmail(event.target.value)} />
          </label>
          <label className="search-field">
            <span>Demo name</span>
            <input value={demoName} onChange={(event) => setDemoName(event.target.value)} />
          </label>
          <label className="search-field">
            <span>Receipt photo</span>
            <input
              accept="image/*,.pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <label className="search-field live-capture-notes">
            <span>Optional business note</span>
            <input
              placeholder="Lunch with vendor, supply run, airfare to client site..."
              value={captureNotes}
              onChange={(event) => setCaptureNotes(event.target.value)}
            />
          </label>
          <div className="live-capture-actions">
            <button type="button" onClick={uploadLiveReceipt} disabled={isUploading}>
              {isUploading ? "Processing..." : "Upload and extract"}
            </button>
            <p>{uploadMessage}</p>
          </div>
        </div>

        {summary ? (
          <div className="live-result-grid">
            <div>
              <span>Total receipts</span>
              <strong>{summary.total_receipts}</strong>
            </div>
            <div>
              <span>Needs review</span>
              <strong>{summary.review_required}</strong>
            </div>
            <div>
              <span>Synced</span>
              <strong>{summary.synced}</strong>
            </div>
          </div>
        ) : null}

        {liveReceipt ? (
          <div className="live-result-grid">
            <div>
              <span>Merchant</span>
              <strong>{liveReceipt.merchantName ?? "Not detected"}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{liveReceipt.total ?? "Not detected"}</strong>
            </div>
            <div>
              <span>Category</span>
              <strong>{liveReceipt.categoryName ?? "Needs review"}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{labelForStatus(liveReceipt.status)}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong>{liveReceipt.overallConfidence ?? "Pending"}</strong>
            </div>
            <div>
              <span>Receipt ID</span>
              <strong>{liveReceipt.receiptId}</strong>
            </div>
            <div className="live-result-summary">
              <span>Decision summary</span>
              <ul className="signal-list">
                {liveReceipt.decisionSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {liveReceipt.processingError ? <li>{liveReceipt.processingError}</li> : null}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      {summary ? (
        <section className="operations-pulse-panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Operator pulse</p>
              <h2>{queueHeadline}</h2>
            </div>
            <span>{queueGuidance}</span>
          </div>
          <div className="operations-pulse-grid">
            <article>
              <span>Needs review</span>
              <strong>{summary.review_required}</strong>
              <p>Receipts that still need a human trust decision.</p>
            </article>
            <article>
              <span>Processing</span>
              <strong>{summary.processing}</strong>
              <p>Receipts still moving through OCR and normalization.</p>
            </article>
            <article>
              <span>Synced</span>
              <strong>{summary.synced}</strong>
              <p>Receipts that already proved the accounting path.</p>
            </article>
            <article>
              <span>Auto-approved</span>
              <strong>{summary.auto_approved}</strong>
              <p>Only the receipts that cleared the full trust policy.</p>
            </article>
          </div>
        </section>
      ) : null}

      <section className="workspace">
        <aside className="workspace-pane">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Inbox</p>
              <h2>Recent captures</h2>
            </div>
            <span>{receipts.length} visible</span>
          </div>
          <label className="search-field">
            <span>Search vendor, category, or note</span>
            <input
              type="search"
              value={search}
              placeholder="Search travel, office, coffee..."
              onChange={(event) => {
                const value = event.target.value;
                startTransition(() => setSearch(value));
              }}
            />
          </label>
          <div className="filter-row" aria-label="Receipt status filters">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                className={filter.value === statusFilter ? "is-active" : undefined}
                onClick={() => setStatusFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          {loadError ? <div className="workspace-message workspace-message-error">{loadError}</div> : null}
          {isLoading ? <div className="workspace-message">Loading receipts from the backend...</div> : null}
          {!isLoading && receipts.length === 0 && !loadError ? (
            <div className="workspace-message">
              No receipts match this filter yet. Use the live capture lane above to add one.
            </div>
          ) : null}
          <div className="receipt-list">
            {receipts.map((receipt) => (
              <button
                key={receipt.id}
                className={`receipt-row ${receipt.id === activeReceipt?.id ? "is-selected" : ""}`}
                onClick={() => setSelectedId(receipt.id)}
                type="button"
              >
                <div>
                  <strong>{receipt.merchant_name || "Unnamed receipt"}</strong>
                  <p>{receipt.category_name || "Uncategorized"}</p>
                </div>
                <div className="receipt-row-meta">
                  <span>{moneyLabel(receipt)}</span>
                  <small>{labelForStatus(receipt.status)}</small>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="workspace-pane workspace-pane-wide">
          {activeReceipt ? (
            <>
              <div className="pane-heading">
                <div>
                  <p className="pane-label">Review lane</p>
                  <h2>{activeReceipt.merchant_name || "Unnamed receipt"}</h2>
                </div>
                <span>{dateLabel(activeReceipt.transaction_date)}</span>
              </div>

              <div className="review-summary">
                <div>
                  <span>Category</span>
                  <strong>{activeReceipt.category_name || "Needs mapping"}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{moneyLabel(activeReceipt)}</strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong>{confidenceLabel(activeReceipt)}</strong>
                </div>
              </div>

              <div className="review-badge-row">
                <span className={`status-pill ${statusToneClass(activeReceipt.status)}`}>
                  {labelForStatus(activeReceipt.status)}
                </span>
                <span
                  className={`status-pill ${activeReceipt.decision.duplicate_of_receipt_id ? "status-bad" : "status-good"}`}
                >
                  {activeReceipt.decision.duplicate_of_receipt_id ? "Duplicate to inspect" : "Duplicate guard clear"}
                </span>
                <span className="status-pill status-neutral">
                  {activeReceipt.decision.auto_approved ? "Auto-approved policy matched" : "Manual review active"}
                </span>
                <span className="status-pill status-neutral">
                  {activeReceipt.ocr_provider ? `OCR ${activeReceipt.ocr_provider}` : "OCR pending"}
                </span>
              </div>

              <div className="review-grid">
                <section>
                  <h3>Decision context</h3>
                  <ul className="signal-list">
                    {activeReceipt.decision.decision_summary.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                    {activeReceipt.processing_error ? <li>{activeReceipt.processing_error}</li> : null}
                  </ul>
                </section>
                <section>
                  <h3>Line items</h3>
                  <div className="line-items">
                    {activeReceipt.line_items.length > 0 ? (
                      activeReceipt.line_items.map((item, index) => (
                        <div key={`${item.description}-${index}`} className="line-item">
                          <div>
                            <strong>{item.description}</strong>
                            <p>Qty {item.quantity || "1"}</p>
                          </div>
                          <span>{item.line_total || item.unit_price || "Pending"}</span>
                        </div>
                      ))
                    ) : (
                      <div className="workspace-message">No line items were extracted yet.</div>
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="workspace-message workspace-message-large">
              Select a receipt or upload a new one to begin review.
            </div>
          )}
        </div>

        <aside className="workspace-pane">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Outbound sync</p>
              <h2>Posting state</h2>
            </div>
          </div>
          {activeReceipt ? (
            <>
              <div className="sync-stack">
                <div>
                  <span>QuickBooks</span>
                  <strong className={`status-pill ${syncToneClass(activeReceipt.sync_targets.quickbooks)}`}>
                    {labelForSyncState(activeReceipt.sync_targets.quickbooks)}
                  </strong>
                </div>
                <div>
                  <span>Excel</span>
                  <strong className={`status-pill ${syncToneClass(activeReceipt.sync_targets.excel)}`}>
                    {labelForSyncState(activeReceipt.sync_targets.excel)}
                  </strong>
                </div>
                <div>
                  <span>Duplicate guard</span>
                  <strong
                    className={`status-pill ${
                      activeReceipt.decision.duplicate_of_receipt_id ? "status-bad" : "status-good"
                    }`}
                  >
                    {activeReceipt.decision.duplicate_of_receipt_id ? "Investigate" : "Clear"}
                  </strong>
                </div>
              </div>
              <div className="inspector-note">
                <p>{activeReceipt.notes || "No operator note has been added yet."}</p>
              </div>
              <div className="workspace-message">{activityMessage}</div>
              <div className="action-cluster">
                {canApprove ? (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={activeAction === `approve:${activeReceipt.id}`}
                  >
                    {activeAction === `approve:${activeReceipt.id}` ? "Approving..." : "Approve"}
                  </button>
                ) : null}
                {canRetry ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleRetryProcessing}
                    disabled={activeAction === `retry:${activeReceipt.id}`}
                  >
                    {activeAction === `retry:${activeReceipt.id}` ? "Retrying..." : "Retry OCR"}
                  </button>
                ) : null}
                {canSync ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleSync("quickbooks")}
                    disabled={activeAction === `sync:quickbooks:${activeReceipt.id}`}
                  >
                    {activeAction === `sync:quickbooks:${activeReceipt.id}` ? "Syncing..." : "Sync QuickBooks"}
                  </button>
                ) : null}
                {canSync ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleSync("excel")}
                    disabled={activeAction === `sync:excel:${activeReceipt.id}`}
                  >
                    {activeAction === `sync:excel:${activeReceipt.id}` ? "Syncing..." : "Sync Excel"}
                  </button>
                ) : null}
                <button type="button" className="secondary" onClick={handleRefresh}>
                  Refresh inbox
                </button>
              </div>
            </>
          ) : (
            <div className="workspace-message">No active receipt selected yet.</div>
          )}
        </aside>
      </section>
    </div>
  );
}

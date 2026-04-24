"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActionToastStack, type ActionToast } from "@/components/action-toast-stack";
import { MobileAppPreview } from "@/components/mobile-app-preview";
import {
  type ApiReceipt,
  type ReceiptSyncJob,
  approveReceipt,
  completeReceiptUpload,
  createReceiptRecord,
  getReceipt,
  getIntegrationHealth,
  getReceiptProcessingStatus,
  getReceiptSyncJobs,
  presignReceiptUpload,
  syncReceipt,
  uploadReceiptBinary,
} from "@/lib/backend-api";
import { getDefaultDemoIdentity } from "@/lib/demo-identity";

type CaptureStage = "ready" | "uploading" | "processing" | "review" | "error";
type SyncTarget = "quickbooks" | "excel";

const defaultDemoIdentity = getDefaultDemoIdentity();

function formatMoney(receipt: ApiReceipt | null) {
  if (!receipt?.total) {
    return "Pending";
  }
  const numeric = Number(receipt.total);
  if (Number.isNaN(numeric)) {
    return receipt.total;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: receipt.currency || "USD",
  }).format(numeric);
}

function stageLabel(stage: CaptureStage) {
  switch (stage) {
    case "uploading":
      return "Uploading";
    case "processing":
      return "Extracting";
    case "review":
      return "Review ready";
    case "error":
      return "Needs attention";
    default:
      return "Ready";
  }
}

function receiptStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "Pending";
  }
  return status.replace(/_/g, " ");
}

function syncStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "Not requested";
  }
  return status.replace(/_/g, " ");
}

function syncStatusTone(status: string | null | undefined) {
  switch (status) {
    case "succeeded":
    case "synced":
      return "status-good";
    case "failed":
    case "needs_reauth":
      return "status-bad";
    case "queued":
    case "running":
    case "syncing":
      return "status-warn";
    default:
      return "status-neutral";
  }
}

function confidenceLabel(receipt: ApiReceipt | null) {
  if (!receipt?.overall_confidence) {
    return "Pending";
  }
  const numeric = Number(receipt.overall_confidence);
  if (Number.isNaN(numeric)) {
    return receipt.overall_confidence;
  }
  return `${Math.round(numeric * 100)}%`;
}

function buildReadyTargets(quickbooksReady: boolean, excelReady: boolean): SyncTarget[] {
  const targets: SyncTarget[] = [];
  if (quickbooksReady) targets.push("quickbooks");
  if (excelReady) targets.push("excel");
  return targets;
}

function targetLabel(target: SyncTarget) {
  return target === "quickbooks" ? "QuickBooks" : "Excel";
}

function targetListLabel(targets: SyncTarget[]) {
  if (targets.length === 0) {
    return "no connected systems";
  }
  if (targets.length === 1) {
    return targetLabel(targets[0]);
  }
  return "QuickBooks and Excel";
}

type LocalPreviewKind = "lowes" | "mountaineer-gas";

type LocalPreviewCase = {
  category: string;
  confidence: Record<string, number>;
  date: string;
  defaultNotes: string;
  decisionSummary: string[];
  displayName: string;
  fileName: string;
  lineItems: ApiReceipt["line_items"];
  merchantName: string;
  paymentMethod: string | null;
  receiptNumber: string | null;
  rawTextSummary: string;
  subtotal: string | null;
  tax: string | null;
  total: string;
  extraPayload?: Record<string, unknown>;
};

const LOCAL_PREVIEW_CASES: Record<LocalPreviewKind, LocalPreviewCase> = {
  lowes: {
    category: "Materials & Supplies",
    confidence: {
      vendor: 0.94,
      date: 0.9,
      total: 0.98,
      category: 0.87,
      paymentMethod: 0.88,
    },
    date: "2025-12-31",
    defaultNotes: "Lowe's construction materials and job-site supplies.",
    decisionSummary: [
      "Local preview extraction from the supplied Lowe's receipt; production OCR still needs to validate it.",
      "Subtotal $459.51 plus tax $33.31 reconciles to total $492.82.",
      "Suggested Materials & Supplies because the line items are nails, adhesive, joist hangers, concrete, and job-site materials.",
      "Manual review remains required because this did not run through the live OCR provider.",
    ],
    displayName: "Lowe's receipt",
    fileName: "IMG_3503.jpeg",
    lineItems: [
      { description: "PS 6-mil 10-ft x 100-ft plastic sheeting", quantity: "1", unit_price: "69.98", line_total: "69.98" },
      { description: "30-lb sinker nails, coated", quantity: "1", unit_price: "62.98", line_total: "62.98" },
      { description: "28 oz LN subfloor adhesive", quantity: "6", unit_price: "5.98", line_total: "35.88" },
      { description: "5/16 hex DB coat fasteners", quantity: "2", unit_price: "39.98", line_total: "79.96" },
      { description: "5-lb sinker nails, coated", quantity: "2", unit_price: "21.98", line_total: "43.96" },
      { description: "USG ZT joist hanger", quantity: "40", unit_price: "2.77", line_total: "110.80" },
      { description: "Quikrete 50-lb concrete mix", quantity: "15", unit_price: "3.73", line_total: "55.95" },
    ],
    merchantName: "Lowe's Home Centers, LLC",
    paymentMethod: "Visa",
    receiptNumber: "25594523",
    rawTextSummary: "Retail receipt with job-site material line items.",
    subtotal: "459.51",
    tax: "33.31",
    total: "492.82",
  },
  "mountaineer-gas": {
    category: "Utilities",
    confidence: {
      vendor: 0.96,
      date: 0.9,
      dueDate: 0.94,
      total: 0.99,
      category: 0.93,
      accountMask: 0.98,
    },
    date: "2026-03-26",
    defaultNotes: "Mountaineer Gas utility statement. Account details masked in preview.",
    decisionSummary: [
      "Local preview extraction from the supplied Mountaineer Gas statement; production OCR still needs to validate it.",
      "Amount due $72.71 and due date April 15 were visible in the statement card.",
      "Suggested Utilities because this is a gas utility statement rather than a retail receipt.",
      "Account and document identifiers are masked in preview to avoid storing sensitive account details.",
    ],
    displayName: "Mountaineer Gas bill",
    extraPayload: {
      accountNumberMasked: "****5156",
      documentType: "utility_statement",
      dueDate: "2026-04-15",
    },
    fileName: "IMG_8391.PNG",
    lineItems: [
      { description: "Natural gas utility statement", quantity: "1", unit_price: "72.71", line_total: "72.71" },
    ],
    merchantName: "Mountaineer Gas",
    paymentMethod: "Payment Processing",
    receiptNumber: "statement-preview",
    rawTextSummary: "Utility bill screenshot with amount due, due date, and masked account details.",
    subtotal: null,
    tax: null,
    total: "72.71",
  },
};

function sampleKindForFileName(fileName: string): LocalPreviewKind {
  const normalized = fileName.toLowerCase();
  if (normalized.includes("8391") || normalized.includes("mountaineer") || normalized.includes("gas")) {
    return "mountaineer-gas";
  }
  return "lowes";
}

function buildLocalPreviewReceipt(kind: LocalPreviewKind, notes: string): ApiReceipt {
  const now = new Date().toISOString();
  const previewCase = LOCAL_PREVIEW_CASES[kind];
  const finalPayload = {
    merchantName: previewCase.merchantName,
    transactionDate: previewCase.date,
    currency: "USD",
    subtotal: previewCase.subtotal,
    tax: previewCase.tax,
    total: previewCase.total,
    paymentMethod: previewCase.paymentMethod,
    categoryName: previewCase.category,
    notes: notes || previewCase.defaultNotes,
    ...previewCase.extraPayload,
  };

  return {
    id: `local-preview-${Date.now()}`,
    status: "review_required",
    source: "upload",
    merchant_name: previewCase.merchantName,
    receipt_number: previewCase.receiptNumber,
    transaction_date: previewCase.date,
    currency: "USD",
    subtotal: previewCase.subtotal,
    tax: previewCase.tax,
    tip: null,
    total: previewCase.total,
    payment_method: previewCase.paymentMethod,
    category_id: null,
    category_name: previewCase.category,
    line_items: previewCase.lineItems,
    notes: notes || previewCase.defaultNotes,
    ocr_provider: "local-preview",
    overall_confidence: kind === "mountaineer-gas" ? "0.9300" : "0.9100",
    confidence: previewCase.confidence,
    payload_layers: {
      raw_ocr_text: `Local preview extraction for ${previewCase.fileName}. ${previewCase.rawTextSummary} Backend OCR was not contacted.`,
      ocr_payload: {
        provider: "local-preview",
        fileName: previewCase.fileName,
      },
      normalized_payload: {
        ...finalPayload,
        provider: "local-preview",
        decisionSummary: previewCase.decisionSummary,
      },
      final_payload: finalPayload,
    },
    decision: {
      decision_summary: previewCase.decisionSummary,
      duplicate_of_receipt_id: null,
      auto_approved: false,
      needs_review: true,
    },
    sync_targets: {
      quickbooks: "not_connected",
      excel: "not_connected",
    },
    sync_jobs: [],
    processed_at: now,
    approved_at: null,
    auto_approved_at: null,
    processing_error: null,
    created_at: now,
    updated_at: now,
  };
}

export function AppCaptureWorkspace() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<CaptureStage>("ready");
  const [stageDetail, setStageDetail] = useState("Choose a receipt image or PDF to start.");
  const [liveReceipt, setLiveReceipt] = useState<ApiReceipt | null>(null);
  const [syncJobs, setSyncJobs] = useState<ReceiptSyncJob[]>([]);
  const [toasts, setToasts] = useState<ActionToast[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [integrationHealth, setIntegrationHealth] = useState<Awaited<ReturnType<typeof getIntegrationHealth>> | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const quickbooksReady = integrationHealth?.sync_ready_targets.includes("quickbooks") ?? false;
  const excelReady = integrationHealth?.sync_ready_targets.includes("excel") ?? false;
  const readyTargets = buildReadyTargets(quickbooksReady, excelReady);
  const lastQuickBooksJob = syncJobs.find((job) => job.target === "quickbooks");
  const lastExcelJob = syncJobs.find((job) => job.target === "excel");
  const hasSuccessfulSync =
    liveReceipt?.sync_targets.quickbooks === "synced" || liveReceipt?.sync_targets.excel === "synced";

  async function refreshReceiptAndJobs(receiptId: string) {
    const [detail, jobs] = await Promise.all([
      getReceipt(defaultDemoIdentity, receiptId),
      getReceiptSyncJobs(defaultDemoIdentity, receiptId).catch(() => ({ data: [] })),
    ]);
    setLiveReceipt(detail);
    setSyncJobs(jobs.data);
    return detail;
  }

  async function waitForProcessing(receiptId: string) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const status = await getReceiptProcessingStatus(defaultDemoIdentity, receiptId);
      if (!["uploaded", "processing"].includes(status.status)) {
        return status;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    }
    return getReceiptProcessingStatus(defaultDemoIdentity, receiptId);
  }

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
    let isCancelled = false;

    async function loadHealth() {
      try {
        const response = await getIntegrationHealth(defaultDemoIdentity);
        if (isCancelled) {
          return;
        }
        setIntegrationHealth(response);
        setIntegrationError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setIntegrationError(error instanceof Error ? error.message : "Unable to load sync health.");
      }
    }

    void loadHealth();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleUpload() {
    if (!selectedFile) {
      pushToast("Select a receipt first", "Choose a photo or PDF before starting the upload.", "warn");
      return;
    }

    setIsBusy(true);
    setLiveReceipt(null);
    setSyncJobs([]);
    setStage("uploading");
    setStageDetail("Uploading the receipt into protected storage.");

    try {
      const presign = await presignReceiptUpload(defaultDemoIdentity, {
        filename: selectedFile.name,
        mimeType: selectedFile.type || "image/jpeg",
        sizeBytes: selectedFile.size,
      });

      await uploadReceiptBinary(presign.upload_url, selectedFile, presign.headers);

      setStage("processing");
      setStageDetail("Extracting vendor, date, total, tax, and category.");

      const createdReceipt = await createReceiptRecord(defaultDemoIdentity, {
        objectKey: presign.object_key,
        mimeType: selectedFile.type || "image/jpeg",
        originalFilename: selectedFile.name,
        notes,
        source: "upload",
      });

      await completeReceiptUpload(defaultDemoIdentity, createdReceipt.id, {
        fileSizeBytes: selectedFile.size,
      });
      await waitForProcessing(createdReceipt.id);

      const detail = await refreshReceiptAndJobs(createdReceipt.id);
      const nextHealth = await getIntegrationHealth(defaultDemoIdentity).catch(() => integrationHealth);
      setIntegrationHealth(nextHealth ?? integrationHealth);
      setStage(detail.status === "failed" ? "error" : "review");
      setStageDetail(
        detail.status === "failed"
          ? detail.processing_error || "The receipt could not be processed."
          : "Check the extracted fields and approve if they look right.",
      );
      pushToast("Receipt uploaded", "The receipt is ready for review.", "good");
    } catch (error) {
      const previewKind = sampleKindForFileName(selectedFile.name);
      const fallbackReceipt = buildLocalPreviewReceipt(previewKind, notes);
      setLiveReceipt(fallbackReceipt);
      setSyncJobs([]);
      setStage("review");
      setStageDetail("Backend is offline, so this is a local preview extraction for review testing.");
      pushToast(
        "Local preview extraction loaded",
        `The backend was not reachable, so the ${LOCAL_PREVIEW_CASES[previewKind].displayName} was parsed as a review-mode test case.`,
        "warn",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleApprove(syncAfterApproval: SyncTarget[] = []) {
    if (!liveReceipt) {
      return;
    }
    setActiveAction(syncAfterApproval.length > 0 ? "approve-sync" : "approve");
    try {
      const updated = await approveReceipt(defaultDemoIdentity, liveReceipt.id, syncAfterApproval);
      await refreshReceiptAndJobs(updated.id);
      setStage("review");
      setStageDetail(
        syncAfterApproval.length > 0
          ? `Approved and queued for ${targetListLabel(syncAfterApproval)}.`
          : "The receipt is approved and ready to sync.",
      );
      pushToast(
        syncAfterApproval.length > 0 ? "Receipt approved and queued" : "Receipt approved",
        syncAfterApproval.length > 0
          ? `The approved payload is moving to ${targetListLabel(syncAfterApproval)}.`
          : "The approved payload is ready for QuickBooks and Excel.",
        "good",
      );
    } catch (error) {
      pushToast("Approval failed", error instanceof Error ? error.message : "The receipt could not be approved.", "warn");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSync(targets: SyncTarget[]) {
    if (!liveReceipt) {
      return;
    }
    setActiveAction(`sync:${targets.join("-")}`);
    try {
      await syncReceipt(defaultDemoIdentity, liveReceipt.id, targets);
      await refreshReceiptAndJobs(liveReceipt.id);
      pushToast(
        targets.length === 2 ? "Sent to both systems" : `Sent to ${targets[0] === "quickbooks" ? "QuickBooks" : "Excel"}`,
        "The sync request has been queued using the approved receipt.",
        "good",
      );
    } catch (error) {
      pushToast("Sync failed", error instanceof Error ? error.message : "The sync could not be started.", "warn");
    } finally {
      setActiveAction(null);
    }
  }

  function handleLoadReceiptSample(kind: LocalPreviewKind) {
    const previewCase = LOCAL_PREVIEW_CASES[kind];
    const sampleReceipt = buildLocalPreviewReceipt(kind, notes);
    setSelectedFile(null);
    setLiveReceipt(sampleReceipt);
    setSyncJobs([]);
    setStage("review");
    setStageDetail(`Loaded the supplied ${previewCase.displayName} as a local preview extraction.`);
    pushToast(
      `${previewCase.displayName} loaded`,
      "Review the extracted vendor, total, tax, category, and line items before production OCR validation.",
      "good",
    );
  }

  const loopSteps = [
    {
      label: "1. Add",
      detail: selectedFile ? "Receipt selected" : "Choose image",
      state: selectedFile || liveReceipt ? "done" : "active",
    },
    {
      label: "2. Extract",
      detail: liveReceipt ? `${confidenceLabel(liveReceipt)} confidence` : stage === "processing" ? "Running OCR" : "Waiting",
      state: liveReceipt ? "done" : stage === "uploading" || stage === "processing" ? "active" : "todo",
    },
    {
      label: "3. Approve",
      detail: liveReceipt?.approved_at ? "Approved" : liveReceipt ? "Needs review" : "Waiting",
      state: liveReceipt?.approved_at ? "done" : liveReceipt ? "active" : "todo",
    },
    {
      label: "4. Sync",
      detail: hasSuccessfulSync ? "Posted" : readyTargets.length ? targetListLabel(readyTargets) : "Connect systems",
      state: hasSuccessfulSync ? "done" : liveReceipt?.approved_at ? "active" : "todo",
    },
  ];

  return (
    <div className="app-workspace-grid app-workspace-grid-capture">
      <section className="app-workspace-main">
        <div className="app-surface-header">
          <div>
            <p className="pane-label">Capture</p>
            <h2>Add one receipt and move it forward.</h2>
            <p>Upload the image, check the extracted fields, then approve and sync.</p>
          </div>
          <span className={`status-pill ${stage === "error" ? "status-warn" : stage === "review" ? "status-good" : "status-neutral"}`}>
            {stageLabel(stage)}
          </span>
        </div>

        <div className="app-flow-stepper" aria-label="Receipt processing steps">
          {loopSteps.map((step) => (
            <article key={step.label} className={`app-flow-step is-${step.state}`}>
              <span>{step.label}</span>
              <strong>{step.detail}</strong>
            </article>
          ))}
        </div>

        <div className="app-compact-status-row">
          <article className="app-compact-status-card">
            <span>QuickBooks</span>
            <strong>{quickbooksReady ? "Ready" : "Not connected"}</strong>
          </article>
          <article className="app-compact-status-card">
            <span>Excel</span>
            <strong>{excelReady ? "Ready" : "Needs workbook"}</strong>
          </article>
          <article className="app-compact-status-card">
            <span>Stage</span>
            <strong>{stageLabel(stage)}</strong>
          </article>
        </div>

        <div className="app-capture-simple-grid app-capture-simple-grid-tight">
          <section className="app-review-card app-capture-upload-card">
            <span className="pane-label">Add image</span>
            <label className="app-upload-dropzone">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              <strong>{selectedFile ? selectedFile.name : "Choose a receipt photo or PDF"}</strong>
              <p>{selectedFile ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB selected` : "Phone photos, scans, and PDFs all work here."}</p>
            </label>

            <label className="app-note-field">
              <span>Optional note</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Client lunch, job-site materials, office supplies..."
              />
            </label>

            <div className="app-primary-actions">
              <button type="button" onClick={handleUpload} disabled={isBusy}>
                {isBusy ? "Working..." : "Upload and extract"}
              </button>
              <button type="button" onClick={() => handleLoadReceiptSample("lowes")} disabled={isBusy}>
                Try Lowe&apos;s receipt
              </button>
              <button type="button" onClick={() => handleLoadReceiptSample("mountaineer-gas")} disabled={isBusy}>
                Try utility bill
              </button>
            </div>

            <div className="app-inline-message">
              <strong>What happens next</strong>
              <p>The image is stored first, then extracted, then held for review before anything syncs.</p>
            </div>
          </section>

          <section className="app-review-card app-capture-result-card">
            <span className="pane-label">Review result</span>
            <h3>{liveReceipt ? liveReceipt.merchant_name || "Unnamed receipt" : "Nothing uploaded yet"}</h3>
            <p>{stageDetail}</p>

            <div className="app-review-detail-list">
              <div>
                <span>Status</span>
                <strong>{liveReceipt ? receiptStatusLabel(liveReceipt.status) : stageLabel(stage)}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatMoney(liveReceipt)}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{liveReceipt?.transaction_date || "Pending"}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{liveReceipt?.category_name || "Needs review"}</strong>
              </div>
              <div>
                <span>Confidence</span>
                <strong>{confidenceLabel(liveReceipt)}</strong>
              </div>
            </div>

            {liveReceipt ? (
              <div className="app-primary-actions app-primary-actions-bar">
                {liveReceipt.status === "review_required" ? (
                  <button
                    type="button"
                    onClick={() => handleApprove(readyTargets)}
                    disabled={activeAction === "approve-sync" || activeAction === "approve"}
                  >
                    {activeAction === "approve-sync" || activeAction === "approve"
                      ? "Approving..."
                      : readyTargets.length > 0
                        ? `Approve and sync to ${targetListLabel(readyTargets)}`
                        : "Approve receipt"}
                  </button>
                ) : null}
                {liveReceipt.status === "review_required" && readyTargets.length > 0 ? (
                  <button type="button" onClick={() => handleApprove()} disabled={activeAction === "approve"}>
                    Approve only
                  </button>
                ) : null}
                {liveReceipt.approved_at && quickbooksReady ? (
                  <button type="button" onClick={() => handleSync(["quickbooks"])} disabled={activeAction === "sync:quickbooks"}>
                    {activeAction === "sync:quickbooks" ? "Sending..." : "Send to QuickBooks"}
                  </button>
                ) : null}
                {liveReceipt.approved_at && excelReady ? (
                  <button type="button" onClick={() => handleSync(["excel"])} disabled={activeAction === "sync:excel"}>
                    {activeAction === "sync:excel" ? "Sending..." : "Send to Excel"}
                  </button>
                ) : null}
                {liveReceipt.approved_at && quickbooksReady && excelReady ? (
                  <button
                    type="button"
                    onClick={() => handleSync(["quickbooks", "excel"])}
                    disabled={activeAction === "sync:quickbooks-excel"}
                  >
                    {activeAction === "sync:quickbooks-excel" ? "Sending..." : "Send to both"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="app-inline-message">
                <strong>What to check</strong>
                <p>Vendor, date, total, and category are the four fields that matter most before approval.</p>
              </div>
            )}
          </section>
        </div>

        {liveReceipt?.decision.decision_summary?.length ? (
          <section className="app-review-card app-review-card-soft">
            <span className="pane-label">Why this looks this way</span>
            <div className="app-review-story-list">
              {liveReceipt.decision.decision_summary.map((item) => (
                <article key={item}>
                  <span aria-hidden="true" />
                  <p>{item}</p>
                </article>
              ))}
              {liveReceipt.processing_error ? (
                <article>
                  <span aria-hidden="true" />
                  <p>{liveReceipt.processing_error}</p>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        {liveReceipt ? (
          <section className="app-sync-proof-panel">
            <div>
              <span className="pane-label">Sync proof</span>
              <h3>Every post has a job record and a recovery path.</h3>
              <p>
                If QuickBooks or Excel rejects a receipt, this panel shows the target, attempts, and exact message to
                recover from.
              </p>
            </div>
            <div className="app-sync-proof-grid">
              <article>
                <span>QuickBooks</span>
                <strong className={`status-pill ${syncStatusTone(lastQuickBooksJob?.status ?? liveReceipt.sync_targets.quickbooks)}`}>
                  {syncStatusLabel(lastQuickBooksJob?.status ?? liveReceipt.sync_targets.quickbooks)}
                </strong>
                <p>{lastQuickBooksJob?.last_error_message || "Creates an approved expense when connected."}</p>
              </article>
              <article>
                <span>Excel</span>
                <strong className={`status-pill ${syncStatusTone(lastExcelJob?.status ?? liveReceipt.sync_targets.excel)}`}>
                  {syncStatusLabel(lastExcelJob?.status ?? liveReceipt.sync_targets.excel)}
                </strong>
                <p>{lastExcelJob?.last_error_message || "Appends the approved fields to the pinned workbook table."}</p>
              </article>
              <article>
                <span>Jobs</span>
                <strong>{syncJobs.length}</strong>
                <p>{syncJobs.length ? "Latest jobs are loaded from the backend." : "No sync has been requested yet."}</p>
              </article>
            </div>
          </section>
        ) : null}
      </section>

      <aside className="app-workspace-side">
        <div className="app-mobile-mirror">
          <div className="app-mobile-mirror-header">
            <div>
              <span className="pane-label">Phone mirror</span>
              <strong>{liveReceipt ? "Receipt ready on mobile" : "Capture flow on mobile"}</strong>
            </div>
            <small>{stageLabel(stage)}</small>
          </div>
          <MobileAppPreview mode={liveReceipt ? "review" : "capture"} queueCount={liveReceipt ? 1 : 3} />
        </div>

        <div className="app-side-status-list">
          <article>
            <span>QuickBooks</span>
            <strong>{quickbooksReady ? "Ready" : "Connect first"}</strong>
          </article>
          <article>
            <span>Excel</span>
            <strong>{excelReady ? "Ready" : "Pick a workbook"}</strong>
          </article>
          <article>
            <span>Need help?</span>
            <strong>
              <Link href="/app/account">Open setup</Link>
            </strong>
          </article>
        </div>

        <div className="app-side-note">
          <span className="pane-label">Simple rule</span>
          <p>{integrationError || "Nothing syncs until the receipt is approved, so the books stay clean."}</p>
        </div>
      </aside>
      <ActionToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

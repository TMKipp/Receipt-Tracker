"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActionToastStack, type ActionToast } from "@/components/action-toast-stack";
import { MobileAppPreview } from "@/components/mobile-app-preview";
import {
  type ApiReceipt,
  approveReceipt,
  completeReceiptUpload,
  createReceiptRecord,
  getReceipt,
  getIntegrationHealth,
  presignReceiptUpload,
  syncReceipt,
  uploadReceiptBinary,
} from "@/lib/backend-api";
import { getDefaultDemoIdentity } from "@/lib/demo-identity";

type CaptureStage = "ready" | "uploading" | "processing" | "review" | "error";

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

export function AppCaptureWorkspace() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<CaptureStage>("ready");
  const [stageDetail, setStageDetail] = useState("Choose a receipt image or PDF to start.");
  const [liveReceipt, setLiveReceipt] = useState<ApiReceipt | null>(null);
  const [toasts, setToasts] = useState<ActionToast[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [integrationHealth, setIntegrationHealth] = useState<Awaited<ReturnType<typeof getIntegrationHealth>> | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const quickbooksReady = integrationHealth?.sync_ready_targets.includes("quickbooks") ?? false;
  const excelReady = integrationHealth?.sync_ready_targets.includes("excel") ?? false;

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

      const detail = await getReceipt(defaultDemoIdentity, createdReceipt.id);
      const nextHealth = await getIntegrationHealth(defaultDemoIdentity).catch(() => integrationHealth);
      setIntegrationHealth(nextHealth ?? integrationHealth);
      setLiveReceipt(detail);
      setStage(detail.status === "failed" ? "error" : "review");
      setStageDetail(
        detail.status === "failed"
          ? detail.processing_error || "The receipt could not be processed."
          : "Check the extracted fields and approve if they look right.",
      );
      pushToast("Receipt uploaded", "The receipt is ready for review.", "good");
    } catch (error) {
      setStage("error");
      setStageDetail(error instanceof Error ? error.message : "The capture flow failed.");
      pushToast("Upload failed", error instanceof Error ? error.message : "The capture flow failed.", "warn");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleApprove() {
    if (!liveReceipt) {
      return;
    }
    setActiveAction("approve");
    try {
      const updated = await approveReceipt(defaultDemoIdentity, liveReceipt.id);
      setLiveReceipt(updated);
      setStage("review");
      setStageDetail("The receipt is approved and ready to sync.");
      pushToast("Receipt approved", "The approved payload is ready for QuickBooks and Excel.", "good");
    } catch (error) {
      pushToast("Approval failed", error instanceof Error ? error.message : "The receipt could not be approved.", "warn");
    } finally {
      setActiveAction(null);
    }
  }

  async function handleSync(targets: Array<"quickbooks" | "excel">) {
    if (!liveReceipt) {
      return;
    }
    setActiveAction(`sync:${targets.join("-")}`);
    try {
      await syncReceipt(defaultDemoIdentity, liveReceipt.id, targets);
      const updated = await getReceipt(defaultDemoIdentity, liveReceipt.id);
      setLiveReceipt(updated);
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
            </div>

            {liveReceipt ? (
              <div className="app-primary-actions app-primary-actions-bar">
                {liveReceipt.status === "review_required" ? (
                  <button type="button" onClick={handleApprove} disabled={activeAction === "approve"}>
                    {activeAction === "approve" ? "Approving..." : "Approve receipt"}
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

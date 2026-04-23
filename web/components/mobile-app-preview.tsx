import type { CommercialReceipt } from "@/lib/mock-data";
import { receipts } from "@/lib/mock-data";

type MobileAppPreviewProps = {
  mode: "capture" | "review" | "queue";
  receipt?: CommercialReceipt;
  queueCount?: number;
};

const defaultReceipt = receipts[0];

export function MobileAppPreview({ mode, receipt = defaultReceipt, queueCount = 3 }: MobileAppPreviewProps) {
  const phoneTitle =
    mode === "capture" ? "Capture receipt" : mode === "review" ? "Review receipt" : "Receipt inbox";

  return (
    <div className="phone-preview">
      <div className="phone-preview-hardware">
        <div className="phone-preview-dynamic-island" />
      </div>
      <div className="phone-preview-status">
        <span>9:41</span>
        <span>LTE</span>
      </div>

      <div className="phone-preview-header">
        <strong>{phoneTitle}</strong>
        <small>{mode === "capture" ? "Camera-first flow" : mode === "review" ? "Trust decision" : "Queue pressure"}</small>
      </div>

      <div className="phone-preview-surface">
        <div className="phone-preview-banner">
          <span>Live workspace</span>
          <strong>{mode === "capture" ? "Queue protected" : mode === "review" ? "Ready to approve" : "Review lane active"}</strong>
        </div>

        {mode === "capture" ? (
          <>
            <div className="phone-preview-topline">
              <span>Offline queue</span>
              <strong>{queueCount} waiting</strong>
            </div>
            <div className="phone-capture-canvas">
              <div className="phone-camera-frame">
                <span>Receipt edges detected</span>
                <strong>Ready to capture</strong>
                <small>Crop, compress, and keep the queue intact if signal drops.</small>
              </div>
              <div className="phone-capture-controls">
                <div>
                  <span>OCR target</span>
                  <strong>Under 8 sec</strong>
                </div>
                <div>
                  <span>Sync route</span>
                  <strong>QB + Excel</strong>
                </div>
              </div>
            </div>
            <div className="phone-capture-cta">
              <button type="button">Capture</button>
              <span>Library</span>
            </div>
          </>
        ) : null}

        {mode === "review" ? (
          <div className="phone-review-stack">
            <div className="phone-preview-topline">
              <span>Selected receipt</span>
              <strong>{receipt.amount}</strong>
            </div>
            <div className="phone-review-card">
              <span>{receipt.vendor}</span>
              <strong>{receipt.category}</strong>
              <small>{receipt.date}</small>
            </div>
            <div className="phone-review-fields">
              <div>
                <span>Confidence</span>
                <strong>{Math.round(receipt.confidence * 100)}%</strong>
              </div>
              <div>
                <span>Duplicate</span>
                <strong>{receipt.duplicateClear ? "Clear" : "Check"}</strong>
              </div>
            </div>
            <div className="phone-review-story">
              {receipt.decisionSummary.slice(0, 2).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div className="phone-review-actions">
              <button type="button">Approve</button>
              <button type="button">Edit</button>
            </div>
          </div>
        ) : null}

        {mode === "queue" ? (
          <div className="phone-queue-list">
            <div className="phone-preview-topline">
              <span>Review required</span>
              <strong>{queueCount} receipts</strong>
            </div>
            <div className="phone-queue-kpis">
              <div>
                <span>Queued</span>
                <strong>{queueCount}</strong>
              </div>
              <div>
                <span>Synced today</span>
                <strong>21</strong>
              </div>
            </div>
            {receipts.slice(0, 3).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.vendor}</strong>
                  <small>{item.category}</small>
                </div>
                <span>{item.amount}</span>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="phone-preview-footer">
        <div className="phone-preview-tabs">
          <span className={mode === "queue" ? "is-active" : undefined}>Inbox</span>
          <span className={mode === "capture" ? "is-active phone-tab-capture" : "phone-tab-capture"}>Capture</span>
          <span className={mode === "review" ? "is-active" : undefined}>Review</span>
        </div>
        <div className="phone-home-indicator" />
      </div>
    </div>
  );
}

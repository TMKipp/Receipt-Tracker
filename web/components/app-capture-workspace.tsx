"use client";

import { startTransition, useEffect, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ActionToastStack, type ActionToast } from "@/components/action-toast-stack";
import { MobileAppPreview } from "@/components/mobile-app-preview";

type CaptureMode = "camera" | "library" | "queue";
type CaptureStage = "ready" | "queued" | "uploading" | "processing" | "review";

const captureStages: Record<
  CaptureStage,
  { label: string; headline: string; detail: string; progress: number; queueCount: number; processingLabel: string }
> = {
  ready: {
    label: "Camera ready",
    headline: "Ready to capture",
    detail: "The viewport is focused on one obvious action so the owner does not hesitate.",
    progress: 12,
    queueCount: 3,
    processingLabel: "Waiting for the next image",
  },
  queued: {
    label: "Queued locally",
    headline: "Stored safely on device",
    detail: "The receipt is protected locally and will move when connectivity is healthy again.",
    progress: 34,
    queueCount: 4,
    processingLabel: "Protected in the offline queue",
  },
  uploading: {
    label: "Uploading",
    headline: "Upload is moving",
    detail: "Object storage transfer has started and the receipt is no longer at risk of disappearing.",
    progress: 61,
    queueCount: 3,
    processingLabel: "Image transfer in progress",
  },
  processing: {
    label: "Processing",
    headline: "OCR and normalization running",
    detail: "The backend is extracting fields and lining the receipt up for trust review.",
    progress: 84,
    queueCount: 3,
    processingLabel: "Receipt intelligence is active",
  },
  review: {
    label: "Review ready",
    headline: "Handed off to trust lane",
    detail: "The owner can now confirm the fields and post the result with confidence.",
    progress: 100,
    queueCount: 2,
    processingLabel: "Ready for approval",
  },
};

const captureModes: Array<{ id: CaptureMode; label: string }> = [
  { id: "camera", label: "Camera" },
  { id: "library", label: "Photo library" },
  { id: "queue", label: "Offline queue" },
];

const stageOrder: CaptureStage[] = ["ready", "queued", "uploading", "processing", "review"];

const sourceLabels: Record<CaptureMode, { title: string; detail: string; readiness: string }> = {
  camera: {
    title: "Live camera intake",
    detail: "The owner is framing a fresh receipt directly inside the capture tool.",
    readiness: "Camera aligned",
  },
  library: {
    title: "Photo library import",
    detail: "An existing receipt image is moving from the device library into the protected upload path.",
    readiness: "Library asset selected",
  },
  queue: {
    title: "Offline queue recovery",
    detail: "Saved captures are waiting for the safest moment to resume upload and processing.",
    readiness: "Queue preserved",
  },
};

const stageSteps: Record<CaptureStage, string[]> = {
  ready: [
    "Keep capture focused on one obvious action so nothing feels hidden behind utility chrome.",
    "Show the queue and next sync target before the owner commits the photo.",
    "Preserve the image locally before any network work begins.",
  ],
  queued: [
    "Save the receipt locally so weak signal never feels like lost work.",
    "Keep the queue visible with the next retry moment and a clear count.",
    "Hold the user in a calm state until connectivity is healthy enough to move.",
  ],
  uploading: [
    "Move the image into protected object storage before the user leaves the screen.",
    "Keep transfer progress visible so the owner trusts the handoff.",
    "Stage the review lane immediately after the upload completes.",
  ],
  processing: [
    "Run OCR and normalization while keeping the latest receipt visible and recoverable.",
    "Explain that the product is building a review-ready record instead of silently spinning.",
    "Hold sync until the receipt is interpretable and the trust lane can take over.",
  ],
  review: [
    "Hand the extracted receipt straight into the trust lane with no dead-end waiting room.",
    "Show why the values look safe and which systems will receive the final payload.",
    "Keep approval and edit equally obvious before anything posts.",
  ],
};

function stageHighlight(stage: CaptureStage) {
  switch (stage) {
    case "queued":
      return "Queue protected";
    case "uploading":
      return "Upload underway";
    case "processing":
      return "Normalization active";
    case "review":
      return "Review handoff ready";
    default:
      return "Capture armed";
  }
}

function modeToPreview(mode: CaptureMode, stage: CaptureStage) {
  if (stage === "review") {
    return "review" as const;
  }

  if (mode === "queue" || stage === "queued") {
    return "queue" as const;
  }

  return "capture" as const;
}

const validModes = new Set<CaptureMode>(["camera", "library", "queue"]);
const validStages = new Set<CaptureStage>(["ready", "queued", "uploading", "processing", "review"]);

function parseMode(value: string | null): CaptureMode {
  if (value && validModes.has(value as CaptureMode)) {
    return value as CaptureMode;
  }

  return "camera";
}

function parseStage(value: string | null): CaptureStage {
  if (value && validStages.has(value as CaptureStage)) {
    return value as CaptureStage;
  }

  return "ready";
}

export function AppCaptureWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<CaptureMode>(() => parseMode(searchParams.get("mode")));
  const [stage, setStage] = useState<CaptureStage>(() => parseStage(searchParams.get("stage")));
  const [toasts, setToasts] = useState<ActionToast[]>([]);

  const stageMeta = captureStages[stage];
  const previewMode = modeToPreview(mode, stage);
  const sourceMeta = sourceLabels[mode];
  const currentSteps = stageSteps[stage];
  const nextHandoff = stage === "review" ? "Owner review lane" : stage === "processing" ? "Trust review staging" : "Protected upload path";

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
    const nextMode = parseMode(searchParams.get("mode"));
    const nextStage = parseStage(searchParams.get("stage"));

    if (nextMode !== mode) {
      setMode(nextMode);
    }

    if (nextStage !== stage) {
      setStage(nextStage);
    }
  }, [mode, searchParams, stage]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (mode === "camera") {
      params.delete("mode");
    } else {
      params.set("mode", mode);
    }

    if (stage === "ready") {
      params.delete("stage");
    } else {
      params.set("stage", stage);
    }

    const next = params.toString();
    const current = searchParams.toString();

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [mode, pathname, router, searchParams, stage]);

  function advanceStage() {
    const currentIndex = stageOrder.indexOf(stage);
    const nextStage = stageOrder[(currentIndex + 1) % stageOrder.length];
    setStage(nextStage);
    pushToast(captureStages[nextStage].label, captureStages[nextStage].detail, nextStage === "review" ? "good" : "neutral");
  }

  return (
    <div className="app-workspace-grid app-workspace-grid-capture">
      <section className="app-workspace-main">
        <div className="app-surface-header">
          <div>
            <p className="pane-label">Capture</p>
            <h2>Add a receipt and move it into review</h2>
            <p>Keep the capture flow simple: choose a source, watch the upload, then hand the receipt into review.</p>
          </div>
          <span className="status-pill status-neutral">{stageMeta.label}</span>
        </div>

        <div className="app-capture-toolbar">
          {captureModes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === mode ? "is-active" : undefined}
              onClick={() => {
                startTransition(() => {
                  setMode(entry.id);
                  if (entry.id === "queue") {
                    setStage("queued");
                  } else if (entry.id === "library") {
                    setStage("uploading");
                  } else if (stage === "review") {
                    setStage("ready");
                  }
                });
                pushToast(
                  `${entry.label} mode`,
                  entry.id === "queue"
                    ? "The queue view keeps offline work visible and recoverable."
                    : entry.id === "library"
                      ? "Library intake now hands straight into upload and processing."
                      : "Camera-first capture is ready for the next receipt.",
                  entry.id === "queue" ? "warn" : "neutral",
                );
              }}
            >
              {entry.label}
            </button>
          ))}
          <span>Last local save 36 sec ago</span>
        </div>

        <section className="app-next-step-strip">
          <div className="app-next-step-copy">
            <span className="pane-label">Start here</span>
            <h2>{stageMeta.headline}</h2>
            <p>{stageMeta.detail}</p>
          </div>
          <div className="app-next-step-kpis">
            <article>
              <span>Source</span>
              <strong>{sourceMeta.readiness}</strong>
            </article>
            <article>
              <span>Progress</span>
              <strong>{stageMeta.progress}%</strong>
            </article>
            <article>
              <span>Next handoff</span>
              <strong>{nextHandoff}</strong>
            </article>
          </div>
        </section>

        <div className="app-review-details-grid">
          <section className="app-review-card">
            <span className="pane-label">Right now</span>
            <div className="app-review-detail-list">
              <div>
                <span>Capture source</span>
                <strong>{sourceMeta.title}</strong>
              </div>
              <div>
                <span>Queue protected</span>
                <strong>{stageMeta.queueCount} receipts</strong>
              </div>
              <div>
                <span>Current posture</span>
                <strong>{stageHighlight(stage)}</strong>
              </div>
              <div>
                <span>Last local save</span>
                <strong>36 sec ago</strong>
              </div>
            </div>
          </section>

          <section className="app-review-card">
            <span className="pane-label">What to do next</span>
            <div className="app-review-story-list">
              {currentSteps.map((step) => (
                <article key={step}>
                  <span aria-hidden="true" />
                  <p>{step}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="app-sync-panel">
          <div className="app-sync-panel-header">
            <div>
              <span className="pane-label">What happens next</span>
              <h3>After this stage completes</h3>
            </div>
            <span className="status-pill status-neutral">{stageMeta.processingLabel}</span>
          </div>
          <div className="app-sync-panel-grid">
            <article>
              <span>Storage</span>
              <strong>{stage === "uploading" ? "Protected upload" : "Receipt stored safely"}</strong>
              <p>The image is kept safe before anything moves into OCR or sync.</p>
            </article>
            <article>
              <span>Review</span>
              <strong>{stage === "review" ? "Open now" : "Next stop"}</strong>
              <p>The owner sees the receipt in the trust lane before anything touches the books.</p>
            </article>
            <article>
              <span>Offline safety</span>
              <strong>{mode === "queue" ? "Recovery active" : "Queue still visible"}</strong>
              <p>Weak signal never looks like lost work because the queue remains visible.</p>
            </article>
          </div>
        </section>

        <div className="app-capture-action-deck">
          <button type="button" onClick={advanceStage}>
            {stage === "review" ? "Start next receipt" : "Advance capture"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("queue");
              setStage("queued");
              pushToast("Offline queue opened", "Receipts saved on device stay visible until connectivity is safe again.", "warn");
            }}
          >
            Open offline queue
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("camera");
              setStage("review");
              pushToast("Review handoff ready", "The latest capture is waiting in the trust lane for approval.", "good");
            }}
          >
            Review last upload
          </button>
        </div>
      </section>

      <aside className="app-workspace-side">
        <div className="app-mobile-mirror">
          <div className="app-mobile-mirror-header">
            <div>
              <span className="pane-label">Phone mirror</span>
              <strong>{mode === "library" ? "Importing on mobile" : mode === "queue" ? "Queue recovery on mobile" : "Capture on mobile"}</strong>
            </div>
            <small>{stageMeta.label}</small>
          </div>
          <MobileAppPreview mode={previewMode} queueCount={stageMeta.queueCount} />
        </div>
        <div className="app-side-note">
          <span className="pane-label">Simple rule</span>
          <p>Make capture feel like one obvious action, then make the handoff into review impossible to miss.</p>
        </div>
      </aside>
      <ActionToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

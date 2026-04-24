export const queueStateMeta: Record<
  string,
  { label: string; detail: string }
> = {
  queued_offline: {
    label: "Queued offline",
    detail: "Stored on device and waiting for a stable connection.",
  },
  uploading: {
    label: "Uploading",
    detail: "Receipt image is moving to object storage right now.",
  },
  processing: {
    label: "Processing",
    detail: "OCR and category checks are running in the background worker.",
  },
  review_required: {
    label: "Review required",
    detail: "Key receipt fields are ready for a human trust decision.",
  },
  approved: {
    label: "Approved",
    detail: "The approved payload is ready for QuickBooks and Excel.",
  },
  synced: {
    label: "Synced",
    detail: "The receipt posted successfully to at least one connected system.",
  },
  failed: {
    label: "Needs attention",
    detail: "The receipt hit a recoverable issue and needs a retry or edit.",
  },
};

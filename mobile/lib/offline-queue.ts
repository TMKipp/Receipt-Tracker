export const queueStateMeta: Record<
  string,
  { label: string; detail: string }
> = {
  "queued offline": {
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
};

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

import type { CapturedReceiptAsset } from "@/lib/backend-api";

export type OfflineQueueState =
  | "queued_offline"
  | "uploading"
  | "processing"
  | "review_required"
  | "approved"
  | "synced"
  | "failed";

export type OfflineQueueRecord = {
  id: string;
  label: string;
  state: OfflineQueueState;
  asset: CapturedReceiptAsset;
  notes: string;
  receiptId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

const QUEUE_STORAGE_KEY = "ledgerlens.captureQueue.v1";
const QUEUE_DIR = `${FileSystem.documentDirectory || ""}receipt-queue`;

export const queueStateMeta: Record<OfflineQueueState, { label: string; detail: string }> = {
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

function nowIso() {
  return new Date().toISOString();
}

function createQueueId() {
  return `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function extensionForAsset(asset: CapturedReceiptAsset) {
  const fileExtension = asset.fileName?.split(".").pop();
  if (fileExtension && fileExtension.length <= 5) {
    return fileExtension;
  }
  if (asset.mimeType === "image/png") {
    return "png";
  }
  if (asset.mimeType === "image/webp") {
    return "webp";
  }
  return "jpg";
}

async function ensureQueueDirectory() {
  if (!FileSystem.documentDirectory) {
    return;
  }

  const info = await FileSystem.getInfoAsync(QUEUE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
  }
}

async function persistAsset(asset: CapturedReceiptAsset, id: string): Promise<CapturedReceiptAsset> {
  if (!FileSystem.documentDirectory) {
    return asset;
  }

  try {
    await ensureQueueDirectory();
    const extension = extensionForAsset(asset);
    const targetUri = `${QUEUE_DIR}/${id}.${extension}`;
    await FileSystem.copyAsync({ from: asset.uri, to: targetUri });
    return {
      ...asset,
      uri: targetUri,
      fileName: asset.fileName || `${id}.${extension}`,
    };
  } catch {
    return asset;
  }
}

async function writeQueue(records: OfflineQueueRecord[]) {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(records));
}

export async function listOfflineQueueRecords(): Promise<OfflineQueueRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function createOfflineQueueRecord(
  asset: CapturedReceiptAsset,
  notes: string,
): Promise<OfflineQueueRecord> {
  const id = createQueueId();
  const persistedAsset = await persistAsset(asset, id);
  const timestamp = nowIso();
  const record: OfflineQueueRecord = {
    id,
    label: persistedAsset.fileName || "Captured receipt",
    state: "queued_offline",
    asset: persistedAsset,
    notes,
    receiptId: null,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const records = await listOfflineQueueRecords();
  await writeQueue([record, ...records.filter((item) => item.id !== id)].slice(0, 50));
  return record;
}

export async function updateOfflineQueueRecord(
  id: string,
  patch: Partial<Omit<OfflineQueueRecord, "id" | "createdAt">>,
): Promise<OfflineQueueRecord | null> {
  const records = await listOfflineQueueRecords();
  const existing = records.find((record) => record.id === id);
  if (!existing) {
    return null;
  }

  const updated: OfflineQueueRecord = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };

  await writeQueue([updated, ...records.filter((record) => record.id !== id)].slice(0, 50));
  return updated;
}

export async function removeOfflineQueueRecord(id: string) {
  const records = await listOfflineQueueRecords();
  const existing = records.find((record) => record.id === id);
  await writeQueue(records.filter((record) => record.id !== id));

  if (existing?.asset.uri.startsWith(FileSystem.documentDirectory || "__never__")) {
    await FileSystem.deleteAsync(existing.asset.uri, { idempotent: true }).catch(() => undefined);
  }
}

export function queueRecordDetail(record: OfflineQueueRecord) {
  return record.lastError || queueStateMeta[record.state].detail;
}

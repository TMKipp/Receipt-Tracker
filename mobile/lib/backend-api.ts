export type MobileDemoIdentity = {
  backendUrl: string;
  demoEmail: string;
  demoName: string;
};

export type CapturedReceiptAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type ApiReceipt = {
  id: string;
  status: string;
  merchant_name: string | null;
  transaction_date: string | null;
  total: string | null;
  currency: string;
  category_name: string | null;
  overall_confidence: string | null;
  approved_at: string | null;
  processing_error: string | null;
  decision: {
    decision_summary: string[];
    duplicate_of_receipt_id: string | null;
    auto_approved: boolean;
    needs_review: boolean;
  };
  sync_targets: {
    quickbooks: string;
    excel: string;
  };
};

export type IntegrationHealthResponse = {
  sync_ready_targets: string[];
};

type PresignUploadResponse = {
  upload_url: string;
  object_key: string;
  headers: Record<string, string>;
};

export function getDefaultMobileIdentity(): MobileDemoIdentity {
  const rawBackendUrl =
    process.env.EXPO_PUBLIC_RECEIPT_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "http://localhost:8000/api/v1";
  const backendUrl = rawBackendUrl.endsWith("/api/v1")
    ? rawBackendUrl
    : `${rawBackendUrl.replace(/\/+$/, "")}/api/v1`;

  return {
    backendUrl,
    demoEmail: process.env.EXPO_PUBLIC_DEMO_EMAIL || "demo@example.com",
    demoName: process.env.EXPO_PUBLIC_DEMO_NAME || "Demo User",
  };
}

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function demoHeaders(identity: MobileDemoIdentity) {
  return {
    "X-Demo-User-Email": identity.demoEmail,
    "X-Demo-User-Name": identity.demoName,
  };
}

function snakeCaseKey(value: string) {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function normalizeApiPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeApiPayload(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [snakeCaseKey(key), normalizeApiPayload(entry)]),
  );
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null ? JSON.stringify(payload) : String(payload || response.statusText);
    throw new Error(detail);
  }

  return normalizeApiPayload(payload) as T;
}

function jsonOptions(identity: MobileDemoIdentity, method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      ...demoHeaders(identity),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function fileNameForAsset(asset: CapturedReceiptAsset) {
  return asset.fileName || `receipt-${Date.now()}.jpg`;
}

function mimeTypeForAsset(asset: CapturedReceiptAsset) {
  return asset.mimeType || "image/jpeg";
}

export async function getIntegrationHealth(identity: MobileDemoIdentity) {
  return requestJson<IntegrationHealthResponse>(`${normalizedBaseUrl(identity.backendUrl)}/integrations/health`, {
    headers: demoHeaders(identity),
  });
}

export async function presignReceiptUpload(identity: MobileDemoIdentity, asset: CapturedReceiptAsset) {
  return requestJson<PresignUploadResponse>(
    `${normalizedBaseUrl(identity.backendUrl)}/uploads/receipts/presign`,
    jsonOptions(identity, "POST", {
      filename: fileNameForAsset(asset),
      mime_type: mimeTypeForAsset(asset),
      size_bytes: Math.max(1, asset.fileSize || 1),
    }),
  );
}

export async function uploadReceiptUri(uploadUrl: string, asset: CapturedReceiptAsset, headers: Record<string, string>) {
  const fileResponse = await fetch(asset.uri);
  const blob = await fileResponse.blob();
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: blob,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function createReceiptRecord(
  identity: MobileDemoIdentity,
  payload: {
    objectKey: string;
    asset: CapturedReceiptAsset;
    notes?: string;
  },
) {
  return requestJson<ApiReceipt>(
    `${normalizedBaseUrl(identity.backendUrl)}/receipts`,
    jsonOptions(identity, "POST", {
      file: {
        object_key: payload.objectKey,
        mime_type: mimeTypeForAsset(payload.asset),
        original_filename: fileNameForAsset(payload.asset),
      },
      source: "camera",
      notes: payload.notes || undefined,
    }),
  );
}

export async function completeReceiptUpload(
  identity: MobileDemoIdentity,
  receiptId: string,
  asset: CapturedReceiptAsset,
) {
  return requestJson(
    `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/upload-complete`,
    jsonOptions(identity, "POST", {
      file_size_bytes: asset.fileSize || undefined,
    }),
  );
}

export async function getReceipt(identity: MobileDemoIdentity, receiptId: string) {
  return requestJson<ApiReceipt>(`${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}`, {
    headers: demoHeaders(identity),
  });
}

export async function approveReceipt(
  identity: MobileDemoIdentity,
  receiptId: string,
  syncAfterApproval: Array<"quickbooks" | "excel">,
) {
  return requestJson<ApiReceipt>(
    `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/approve`,
    jsonOptions(identity, "POST", {
      approved: true,
      sync_after_approval: syncAfterApproval,
    }),
  );
}

export async function syncReceipt(
  identity: MobileDemoIdentity,
  receiptId: string,
  targets: Array<"quickbooks" | "excel">,
) {
  return requestJson(
    `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/sync`,
    jsonOptions(identity, "POST", {
      targets,
      force_resync: false,
    }),
  );
}

export async function uploadCapturedReceipt(
  identity: MobileDemoIdentity,
  asset: CapturedReceiptAsset,
  notes?: string,
) {
  const presign = await presignReceiptUpload(identity, asset);
  await uploadReceiptUri(presign.upload_url, asset, presign.headers);
  const created = await createReceiptRecord(identity, {
    objectKey: presign.object_key,
    asset,
    notes,
  });
  await completeReceiptUpload(identity, created.id, asset);
  return getReceipt(identity, created.id);
}

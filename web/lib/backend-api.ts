export type ReceiptSyncState =
  | "not_connected"
  | "not_requested"
  | "queued"
  | "syncing"
  | "synced"
  | "failed";

export type ReceiptSyncJob = {
  id: string;
  target: "quickbooks" | "excel";
  status: string;
  attempts: number;
  external_object_id: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};

export type ApiReceipt = {
  id: string;
  status: string;
  source: string;
  merchant_name: string | null;
  receipt_number: string | null;
  transaction_date: string | null;
  currency: string;
  subtotal: string | null;
  tax: string | null;
  tip: string | null;
  total: string | null;
  payment_method: string | null;
  category_id: string | null;
  category_name: string | null;
  line_items: Array<{
    description: string;
    quantity: string | null;
    unit_price: string | null;
    line_total: string | null;
  }>;
  notes: string | null;
  ocr_provider: string | null;
  overall_confidence: string | null;
  confidence: Record<string, number> | null;
  payload_layers: {
    raw_ocr_text: string | null;
    ocr_payload: Record<string, unknown> | null;
    normalized_payload: Record<string, unknown> | null;
    final_payload: Record<string, unknown> | null;
  };
  decision: {
    decision_summary: string[];
    duplicate_of_receipt_id: string | null;
    auto_approved: boolean;
    needs_review: boolean;
  };
  sync_targets: {
    quickbooks: ReceiptSyncState;
    excel: ReceiptSyncState;
  };
  sync_jobs: ReceiptSyncJob[];
  processed_at: string | null;
  approved_at: string | null;
  auto_approved_at: string | null;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ReceiptListResponse = {
  data: ApiReceipt[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

export type ReceiptSummaryResponse = {
  total_receipts: number;
  review_required: number;
  processing: number;
  synced: number;
  failed: number;
  auto_approved: number;
};

export type MonthlySpendResponse = {
  data: Array<{
    month: string;
    currency: string;
    total: string;
    categories: Array<{
      category_name: string;
      total: string;
    }>;
  }>;
};

export type IntegrationHealthResponse = {
  quickbooks: {
    provider: string;
    status: string;
    connected_at: string | null;
    external_tenant_name: string | null;
    scopes: string[];
  };
  microsoft: {
    provider: string;
    status: string;
    connected_at: string | null;
    external_tenant_name: string | null;
    scopes: string[];
  };
  workbook_binding: {
    drive_id: string;
    item_id: string;
    table_id: string;
    workbook_name: string | null;
    worksheet_name: string | null;
    table_name: string | null;
    last_validated_at: string | null;
  } | null;
  sync_ready_targets: string[];
};

export type BillingSnapshotResponse = {
  entitlement: {
    active: boolean;
    paywall_required: boolean;
    trial_days_remaining: number | null;
    entitlement: {
      provider: string;
      entitlement_key: string;
      product_id: string | null;
      status: string;
      starts_at: string | null;
      trial_ends_at: string | null;
      expires_at: string | null;
      latest_event_at: string | null;
      app_user_id: string | null;
    } | null;
  };
  workbook_binding: IntegrationHealthResponse["workbook_binding"];
};

export type PresignUploadResponse = {
  upload_url: string;
  object_key: string;
  headers: Record<string, string>;
};

export type ReceiptProcessingStatusResponse = {
  receipt_id: string;
  status: string;
  processed_at: string | null;
  approved_at: string | null;
  auto_approved_at: string | null;
  processing_error: string | null;
  decision: {
    decision_summary: string[];
    duplicate_of_receipt_id: string | null;
    auto_approved: boolean;
    needs_review: boolean;
  };
  overall_confidence: string | null;
};

export type ReceiptSyncJobListResponse = {
  data: ReceiptSyncJob[];
};

export type MicrosoftWorkbookCandidate = {
  drive_id: string;
  item_id: string;
  name: string;
  web_url: string | null;
  path: string | null;
  last_modified_at: string | null;
  mime_type: string | null;
};

export type MicrosoftWorkbookSearchResponse = {
  data: MicrosoftWorkbookCandidate[];
};

export type MicrosoftWorkbookTable = {
  table_id: string;
  table_name: string;
  worksheet_name: string | null;
  columns: string[];
  supported_columns: string[];
  missing_recommended_columns: string[];
  sync_ready: boolean;
};

export type MicrosoftWorkbookTableListResponse = {
  data: MicrosoftWorkbookTable[];
};

export type WorkbookBindingResponse = {
  drive_id: string;
  item_id: string;
  table_id: string;
  workbook_name: string | null;
  worksheet_name: string | null;
  table_name: string | null;
  last_validated_at: string | null;
};

export type DemoIdentity = {
  backendUrl: string;
  demoEmail: string;
  demoName: string;
};

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function demoHeaders(identity: DemoIdentity) {
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
      typeof payload === "object" && payload !== null
        ? JSON.stringify(payload, null, 2)
        : String(payload || response.statusText);
    throw new Error(detail);
  }

  return normalizeApiPayload(payload) as T;
}

function jsonOptions(identity: DemoIdentity, method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      ...demoHeaders(identity),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function urlWithParams(base: string, params: Record<string, string | number | undefined | null>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `${base}?${query}` : base;
}

export async function listReceipts(
  identity: DemoIdentity,
  filters: { status?: string; q?: string; limit?: number } = {},
) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.q && filters.q.trim()) params.set("q", filters.q.trim());
  params.set("limit", String(filters.limit ?? 50));
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts?${params.toString()}`;
  return requestJson<ReceiptListResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function getReceipt(identity: DemoIdentity, receiptId: string) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}`;
  return requestJson<ApiReceipt>(url, {
    headers: demoHeaders(identity),
  });
}

export async function getReceiptSummary(identity: DemoIdentity) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/summary`;
  return requestJson<ReceiptSummaryResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function retryReceiptProcessing(identity: DemoIdentity, receiptId: string) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/retry-processing`;
  return requestJson(url, jsonOptions(identity, "POST"));
}

export async function approveReceipt(
  identity: DemoIdentity,
  receiptId: string,
  syncAfterApproval: Array<"quickbooks" | "excel"> = [],
) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/approve`;
  return requestJson<ApiReceipt>(
    url,
    jsonOptions(identity, "POST", {
      approved: true,
      sync_after_approval: syncAfterApproval,
    }),
  );
}

export async function syncReceipt(
  identity: DemoIdentity,
  receiptId: string,
  targets: Array<"quickbooks" | "excel">,
) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/sync`;
  return requestJson<{ receiptId: string; status: string; targets: string[]; jobIds: string[] }>(
    url,
    jsonOptions(identity, "POST", {
      targets,
      force_resync: false,
    }),
  );
}

export async function getMonthlySpend(identity: DemoIdentity) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/reports/monthly-spend`;
  return requestJson<MonthlySpendResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function getIntegrationHealth(identity: DemoIdentity) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/integrations/health`;
  return requestJson<IntegrationHealthResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function getReceiptProcessingStatus(identity: DemoIdentity, receiptId: string) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/processing-status`;
  return requestJson<ReceiptProcessingStatusResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function getReceiptSyncJobs(identity: DemoIdentity, receiptId: string) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/sync-jobs`;
  return requestJson<ReceiptSyncJobListResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function getBillingSnapshot(identity: DemoIdentity) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/billing/snapshot`;
  return requestJson<BillingSnapshotResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function presignReceiptUpload(
  identity: DemoIdentity,
  payload: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    sha256?: string | null;
  },
) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/uploads/receipts/presign`;
  return requestJson<PresignUploadResponse>(
    url,
    jsonOptions(identity, "POST", {
      filename: payload.filename,
      mime_type: payload.mimeType,
      size_bytes: payload.sizeBytes,
      sha256: payload.sha256 ?? undefined,
    }),
  );
}

export async function uploadReceiptBinary(uploadUrl: string, file: Blob, headers: Record<string, string>) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function createReceiptRecord(
  identity: DemoIdentity,
  payload: {
    objectKey: string;
    mimeType: string;
    originalFilename: string;
    notes?: string;
    source?: "camera" | "upload" | "email" | "api";
  },
) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts`;
  return requestJson<ApiReceipt>(
    url,
    jsonOptions(identity, "POST", {
      file: {
        object_key: payload.objectKey,
        mime_type: payload.mimeType,
        original_filename: payload.originalFilename,
      },
      source: payload.source ?? "upload",
      notes: payload.notes || undefined,
    }),
  );
}

export async function completeReceiptUpload(
  identity: DemoIdentity,
  receiptId: string,
  payload: {
    fileSizeBytes?: number;
    sha256Hash?: string;
  } = {},
) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/upload-complete`;
  return requestJson<ReceiptProcessingStatusResponse>(
    url,
    jsonOptions(identity, "POST", {
      file_size_bytes: payload.fileSizeBytes,
      sha256_hash: payload.sha256Hash,
    }),
  );
}

export async function searchMicrosoftWorkbooks(identity: DemoIdentity, query: string, limit = 8) {
  const url = urlWithParams(`${normalizedBaseUrl(identity.backendUrl)}/integrations/microsoft/workbooks`, {
    q: query.trim(),
    limit,
  });
  return requestJson<MicrosoftWorkbookSearchResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function listMicrosoftWorkbookTables(identity: DemoIdentity, driveId: string, itemId: string) {
  const url = urlWithParams(`${normalizedBaseUrl(identity.backendUrl)}/integrations/microsoft/workbook-tables`, {
    driveId,
    itemId,
  });
  return requestJson<MicrosoftWorkbookTableListResponse>(url, {
    headers: demoHeaders(identity),
  });
}

export async function bindExcelWorkbook(
  identity: DemoIdentity,
  payload: {
    driveId: string;
    itemId: string;
    tableId: string;
    workbookName?: string | null;
    worksheetName?: string | null;
    tableName?: string | null;
  },
) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/billing/excel-workbook`;
  return requestJson<WorkbookBindingResponse>(
    url,
    jsonOptions(identity, "PUT", {
      drive_id: payload.driveId,
      item_id: payload.itemId,
      table_id: payload.tableId,
      workbook_name: payload.workbookName ?? undefined,
      worksheet_name: payload.worksheetName ?? undefined,
      table_name: payload.tableName ?? undefined,
    }),
  );
}

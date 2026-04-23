export type ReceiptSyncState =
  | "not_connected"
  | "not_requested"
  | "queued"
  | "syncing"
  | "synced"
  | "failed";

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

  return payload as T;
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

export async function approveReceipt(identity: DemoIdentity, receiptId: string) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/receipts/${receiptId}/approve`;
  return requestJson<ApiReceipt>(
    url,
    jsonOptions(identity, "POST", {
      approved: true,
      sync_after_approval: [],
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

export async function getBillingSnapshot(identity: DemoIdentity) {
  const url = `${normalizedBaseUrl(identity.backendUrl)}/billing/snapshot`;
  return requestJson<BillingSnapshotResponse>(url, {
    headers: demoHeaders(identity),
  });
}

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const parsed = {
    backend: process.env.RECEIPT_TRACKER_BACKEND_URL || "http://localhost:8000/api/v1",
    demoEmail: process.env.RECEIPT_TRACKER_DEMO_EMAIL || "demo@example.com",
    demoName: process.env.RECEIPT_TRACKER_DEMO_NAME || "Demo User",
    notes: "",
    approve: false,
    syncTargets: [],
    file: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--backend") parsed.backend = argv[index + 1] || parsed.backend;
    if (value === "--email") parsed.demoEmail = argv[index + 1] || parsed.demoEmail;
    if (value === "--name") parsed.demoName = argv[index + 1] || parsed.demoName;
    if (value === "--notes") parsed.notes = argv[index + 1] || parsed.notes;
    if (value === "--file") parsed.file = argv[index + 1] || parsed.file;
    if (value === "--approve") parsed.approve = true;
    if (value === "--sync-targets") {
      parsed.syncTargets = String(argv[index + 1] || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  if (!parsed.file) {
    throw new Error("Usage: node scripts/smoke-receipt-flow.mjs --file C:\\path\\to\\receipt.jpg [--approve] [--sync-targets quickbooks,excel]");
  }

  return parsed;
}

function guessMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null ? JSON.stringify(payload, null, 2) : String(payload);
    throw new Error(`${options.method || "GET"} ${url} failed: ${detail}`);
  }

  return payload;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileBuffer = await readFile(args.file);
  const mimeType = guessMimeType(args.file);
  const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
  const headers = {
    "Content-Type": "application/json",
    "X-Demo-User-Email": args.demoEmail,
    "X-Demo-User-Name": args.demoName,
  };

  const presign = await requestJson(`${args.backend}/uploads/receipts/presign`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      filename: path.basename(args.file),
      mime_type: mimeType,
      size_bytes: fileBuffer.length,
      sha256,
    }),
  });

  const uploadResponse = await fetch(presign.upload_url, {
    method: "PUT",
    headers: presign.headers,
    body: fileBuffer,
  });
  if (!uploadResponse.ok) {
    throw new Error(`PUT ${presign.upload_url} failed: ${await uploadResponse.text()}`);
  }

  const createdReceipt = await requestJson(`${args.backend}/receipts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: "upload",
      notes: args.notes || undefined,
      file: {
        object_key: presign.object_key,
        mime_type: mimeType,
        original_filename: path.basename(args.file),
      },
    }),
  });

  await requestJson(`${args.backend}/receipts/${createdReceipt.id}/upload-complete`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      file_size_bytes: fileBuffer.length,
      sha256_hash: sha256,
    }),
  });

  let receipt = await requestJson(`${args.backend}/receipts/${createdReceipt.id}`, {
    headers: {
      "X-Demo-User-Email": args.demoEmail,
      "X-Demo-User-Name": args.demoName,
    },
  });

  if (args.approve) {
    receipt = await requestJson(`${args.backend}/receipts/${createdReceipt.id}/approve`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        approved: true,
        sync_after_approval: args.syncTargets,
      }),
    });
  }

  const summary = {
    receiptId: receipt.id,
    status: receipt.status,
    merchantName: receipt.merchant_name,
    categoryName: receipt.category_name,
    total: receipt.total,
    overallConfidence: receipt.overall_confidence,
    decisionSummary: receipt.decision?.decision_summary || [],
    syncTargets: receipt.sync_targets || null,
    processingError: receipt.processing_error,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const parsed = {
    backend: process.env.RECEIPT_TRACKER_BACKEND_URL || "http://localhost:8000/api/v1",
    demoEmail: process.env.RECEIPT_TRACKER_DEMO_EMAIL || "demo@example.com",
    demoName: process.env.RECEIPT_TRACKER_DEMO_NAME || "Demo User",
    authToken: process.env.RECEIPT_TRACKER_BEARER_TOKEN || "",
    files: [],
    syncTargets: [],
    iterations: 1,
    processingTimeoutSeconds: 45,
    syncTimeoutSeconds: 90,
    pollMs: 1200,
    minQuickBooksSuccess: 0.98,
    minExcelSuccess: 0.97,
    maxProcessingMedianSeconds: 8,
    strict: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--backend") parsed.backend = argv[index + 1] || parsed.backend;
    if (value === "--email") parsed.demoEmail = argv[index + 1] || parsed.demoEmail;
    if (value === "--name") parsed.demoName = argv[index + 1] || parsed.demoName;
    if (value === "--auth-token") parsed.authToken = argv[index + 1] || parsed.authToken;
    if (value === "--sync-targets") {
      parsed.syncTargets = String(argv[index + 1] || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    if (value === "--files") {
      parsed.files = String(argv[index + 1] || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    if (value === "--iterations") parsed.iterations = Number(argv[index + 1] || parsed.iterations);
    if (value === "--processing-timeout-seconds") {
      parsed.processingTimeoutSeconds = Number(argv[index + 1] || parsed.processingTimeoutSeconds);
    }
    if (value === "--sync-timeout-seconds") parsed.syncTimeoutSeconds = Number(argv[index + 1] || parsed.syncTimeoutSeconds);
    if (value === "--poll-ms") parsed.pollMs = Number(argv[index + 1] || parsed.pollMs);
    if (value === "--min-qb-success") parsed.minQuickBooksSuccess = Number(argv[index + 1] || parsed.minQuickBooksSuccess);
    if (value === "--min-excel-success") parsed.minExcelSuccess = Number(argv[index + 1] || parsed.minExcelSuccess);
    if (value === "--max-processing-median-seconds") {
      parsed.maxProcessingMedianSeconds = Number(argv[index + 1] || parsed.maxProcessingMedianSeconds);
    }
    if (value === "--strict") parsed.strict = true;
  }

  if (!parsed.files.length) {
    throw new Error(
      "Usage: node scripts/provider-sandbox-benchmark.mjs --files C:\\path\\receipt1.jpg,C:\\path\\receipt2.jpg [--sync-targets quickbooks,excel] [--iterations 3] [--auth-token TOKEN] [--strict]",
    );
  }

  if (!Number.isFinite(parsed.iterations) || parsed.iterations < 1) {
    throw new Error("`--iterations` must be a positive integer.");
  }

  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildIdentityHeaders(args) {
  if (args.authToken && args.authToken.trim()) {
    return {
      Authorization: `Bearer ${args.authToken.trim()}`,
    };
  }
  return {
    "X-Demo-User-Email": args.demoEmail,
    "X-Demo-User-Name": args.demoName,
  };
}

function guessMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".webp") return "image/webp";
  if (extension === ".txt") return "text/plain";
  return "image/jpeg";
}

function snakeCaseKey(value) {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function normalizeApiPayload(value) {
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
    const detail =
      typeof payload === "object" && payload !== null ? JSON.stringify(payload, null, 2) : String(payload);
    throw new Error(`${options.method || "GET"} ${url} failed: ${detail}`);
  }

  return normalizeApiPayload(payload);
}

function percentile(sortedNumbers, percentileValue) {
  if (!sortedNumbers.length) {
    return null;
  }
  const index = Math.ceil(percentileValue * sortedNumbers.length) - 1;
  return sortedNumbers[Math.max(0, Math.min(index, sortedNumbers.length - 1))];
}

function median(sortedNumbers) {
  if (!sortedNumbers.length) {
    return null;
  }
  const middle = Math.floor(sortedNumbers.length / 2);
  if (sortedNumbers.length % 2 === 0) {
    return Number(((sortedNumbers[middle - 1] + sortedNumbers[middle]) / 2).toFixed(3));
  }
  return Number(sortedNumbers[middle].toFixed(3));
}

async function resolveHealth(args, headers) {
  try {
    return await requestJson(`${args.backend}/integrations/health`, { headers });
  } catch (error) {
    return {
      quickbooks: { status: "not_connected" },
      microsoft: { status: "not_connected" },
      workbook_binding: null,
      sync_ready_targets: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function waitForProcessing(args, headers, receiptId) {
  const startedAt = Date.now();
  const timeoutMs = args.processingTimeoutSeconds * 1000;
  while (Date.now() - startedAt <= timeoutMs) {
    const statusPayload = await requestJson(`${args.backend}/receipts/${receiptId}/processing-status`, { headers });
    if (!["uploaded", "processing"].includes(statusPayload.status)) {
      return {
        statusPayload,
        seconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
      };
    }
    await sleep(args.pollMs);
  }
  const finalStatus = await requestJson(`${args.backend}/receipts/${receiptId}/processing-status`, { headers });
  return {
    statusPayload: finalStatus,
    seconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
  };
}

function latestJobsByTarget(syncJobs) {
  const byTarget = {};
  for (const job of syncJobs || []) {
    const target = job.target;
    if (!target) continue;
    if (!byTarget[target] || new Date(job.updated_at) > new Date(byTarget[target].updated_at)) {
      byTarget[target] = job;
    }
  }
  return byTarget;
}

async function waitForSyncTargets(args, headers, receiptId, targets) {
  const terminalStatuses = new Set(["succeeded", "failed", "needs_reauth"]);
  const startedAt = Date.now();
  const timeoutMs = args.syncTimeoutSeconds * 1000;
  let latest = [];

  while (Date.now() - startedAt <= timeoutMs) {
    const syncJobsPayload = await requestJson(`${args.backend}/receipts/${receiptId}/sync-jobs`, { headers });
    latest = syncJobsPayload.data || [];
    const latestByTarget = latestJobsByTarget(latest);
    const allTargetsDone = targets.every((target) => {
      const job = latestByTarget[target];
      return job && terminalStatuses.has(String(job.status).toLowerCase());
    });
    if (allTargetsDone) {
      return latestByTarget;
    }

    await requestJson(`${args.backend}/integrations/worker/run?processingLimit=1&syncLimit=25`, {
      method: "POST",
      headers,
    }).catch(() => null);
    await sleep(args.pollMs);
  }

  return latestJobsByTarget(latest);
}

async function runSingleBenchmarkCase(args, headers, filePath, syncTargets) {
  const fileBuffer = await readFile(filePath);
  const mimeType = guessMimeType(filePath);
  const sha256 = createHash("sha256").update(fileBuffer).digest("hex");

  const presign = await requestJson(`${args.backend}/uploads/receipts/presign`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: path.basename(filePath),
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
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "upload",
      notes: `Provider benchmark run for ${path.basename(filePath)}`,
      file: {
        object_key: presign.object_key,
        mime_type: mimeType,
        original_filename: path.basename(filePath),
      },
    }),
  });

  await requestJson(`${args.backend}/receipts/${createdReceipt.id}/upload-complete`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      file_size_bytes: fileBuffer.length,
      sha256_hash: sha256,
    }),
  });

  const processing = await waitForProcessing(args, headers, createdReceipt.id);
  if (processing.statusPayload.status === "failed") {
    return {
      receipt_id: createdReceipt.id,
      file: filePath,
      processing_seconds: processing.seconds,
      processing_status: processing.statusPayload.status,
      processing_error: processing.statusPayload.processing_error || "Processing failed",
      sync: {},
      passed: false,
    };
  }

  await requestJson(`${args.backend}/receipts/${createdReceipt.id}/approve`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      approved: true,
      sync_after_approval: syncTargets,
    }),
  });

  const syncByTarget = await waitForSyncTargets(args, headers, createdReceipt.id, syncTargets);
  const perTarget = Object.fromEntries(
    syncTargets.map((target) => {
      const job = syncByTarget[target];
      if (!job) {
        return [
          target,
          {
            status: "missing",
            success: false,
          },
        ];
      }
      return [
        target,
        {
          status: job.status,
          success: String(job.status).toLowerCase() === "succeeded",
          request_id: job.provider_request_id || null,
          attachment_status: job.attachment_status || null,
          attachment_error: job.attachment_error || null,
          error: job.last_error_message || null,
        },
      ];
    }),
  );

  return {
    receipt_id: createdReceipt.id,
    file: filePath,
    processing_seconds: processing.seconds,
    processing_status: processing.statusPayload.status,
    processing_error: processing.statusPayload.processing_error || null,
    sync: perTarget,
    passed: syncTargets.every((target) => perTarget[target]?.success),
  };
}

function resolveTargets(args, health) {
  if (args.syncTargets.length) {
    return args.syncTargets;
  }
  const readyTargets = Array.isArray(health.sync_ready_targets) ? health.sync_ready_targets : [];
  return readyTargets.length ? readyTargets : ["quickbooks", "excel"];
}

function computeScorecard(results, targets) {
  const processingDurations = results
    .map((entry) => entry.processing_seconds)
    .filter((value) => typeof value === "number")
    .sort((left, right) => left - right);
  const targetStats = Object.fromEntries(
    targets.map((target) => {
      const runs = results.filter((entry) => entry.sync?.[target]);
      const succeeded = runs.filter((entry) => entry.sync[target].success).length;
      const failed = runs.length - succeeded;
      const successRate = runs.length ? Number((succeeded / runs.length).toFixed(4)) : null;
      return [
        target,
        {
          runs: runs.length,
          succeeded,
          failed,
          success_rate: successRate,
        },
      ];
    }),
  );
  return {
    totals: {
      runs: results.length,
      passed: results.filter((entry) => entry.passed).length,
      failed: results.filter((entry) => !entry.passed).length,
    },
    processing: {
      min_seconds: processingDurations.length ? Number(processingDurations[0].toFixed(3)) : null,
      median_seconds: median(processingDurations),
      p95_seconds:
        processingDurations.length ? Number(percentile(processingDurations, 0.95).toFixed(3)) : null,
      max_seconds:
        processingDurations.length
          ? Number(processingDurations[processingDurations.length - 1].toFixed(3))
          : null,
    },
    targets: targetStats,
  };
}

function evaluateThresholds(args, scorecard) {
  const failures = [];
  const qbRate = scorecard.targets.quickbooks?.success_rate;
  const excelRate = scorecard.targets.excel?.success_rate;
  const medianSeconds = scorecard.processing.median_seconds;

  if (qbRate !== null && qbRate < args.minQuickBooksSuccess) {
    failures.push(
      `QuickBooks success rate ${qbRate} is below threshold ${args.minQuickBooksSuccess}.`,
    );
  }
  if (excelRate !== null && excelRate < args.minExcelSuccess) {
    failures.push(`Excel success rate ${excelRate} is below threshold ${args.minExcelSuccess}.`);
  }
  if (medianSeconds !== null && medianSeconds > args.maxProcessingMedianSeconds) {
    failures.push(
      `Median processing time ${medianSeconds}s is above threshold ${args.maxProcessingMedianSeconds}s.`,
    );
  }
  return failures;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const headers = buildIdentityHeaders(args);

  const health = await resolveHealth(args, headers);
  const targets = resolveTargets(args, health);
  const filesToRun = Array.from({ length: args.iterations }).flatMap((_, index) =>
    args.files.map((filePath) => ({ filePath, index })),
  );

  const results = [];
  for (const item of filesToRun) {
    try {
      const result = await runSingleBenchmarkCase(args, headers, item.filePath, targets);
      results.push(result);
    } catch (error) {
      results.push({
        receipt_id: null,
        file: item.filePath,
        processing_seconds: null,
        processing_status: "failed",
        processing_error: error instanceof Error ? error.message : String(error),
        sync: {},
        passed: false,
      });
    }
  }

  const scorecard = computeScorecard(results, targets);
  const thresholdFailures = evaluateThresholds(args, scorecard);
  const report = {
    backend: args.backend,
    evaluated_at: new Date().toISOString(),
    auth_mode: args.authToken ? "bearer" : "demo_headers",
    sync_targets: targets,
    health,
    thresholds: {
      min_quickbooks_success: args.minQuickBooksSuccess,
      min_excel_success: args.minExcelSuccess,
      max_processing_median_seconds: args.maxProcessingMedianSeconds,
    },
    threshold_failures: thresholdFailures,
    scorecard,
    results,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (args.strict && thresholdFailures.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

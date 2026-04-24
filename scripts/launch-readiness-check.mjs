import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const ciMode = args.has("--ci");

function commandAvailable(command, versionArgs = ["--version"]) {
  if (command === "current-node") {
    return {
      ok: true,
      detail: process.version,
    };
  }
  const commandParts = Array.isArray(command) ? command : [command];
  const [executable, ...baseArgs] = commandParts;
  const result = spawnSync(executable, [...baseArgs, ...versionArgs], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  return {
    ok: result.status === 0,
    blocked: result.error?.code === "EPERM",
    detail:
      result.status === 0
        ? String(result.stdout || result.stderr).trim().split(/\r?\n/)[0]
        : result.error?.message || "not found",
  };
}

function loadLocalEnv() {
  const env = new Map(Object.entries(process.env).filter(([, value]) => String(value || "").trim()));
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    return env;
  }

  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim();
    if (key && value && value !== "replace-me") {
      env.set(key.trim(), value);
    }
  }
  return env;
}

const localEnv = loadLocalEnv();

function fileCheck(label, relativePath, required = true) {
  return {
    label,
    status: existsSync(path.join(root, relativePath)) ? "pass" : required ? "blocker" : "warn",
    detail: relativePath,
  };
}

function commandCheck(label, command, versionArgs = ["--version"], required = true) {
  const result = commandAvailable(command, versionArgs);
  return {
    label,
    status: result.ok ? "pass" : result.blocked ? "warn" : required ? "blocker" : "warn",
    detail: result.detail,
  };
}

function envCheck(label, keys, required = true) {
  const missing = keys.filter((key) => !localEnv.has(key));
  return {
    label,
    status: missing.length === 0 ? "pass" : required ? "blocker" : "warn",
    detail: missing.length === 0 ? `${keys.length} configured` : `missing ${missing.join(", ")}`,
  };
}

function statusIcon(status) {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "BLOCK";
}

const checks = [
  {
    category: "Runtime",
    checks: [
      commandCheck("Node.js", "current-node"),
      commandCheck("Python backend runtime", "python", ["--version"]),
      commandCheck("Docker for local Postgres/Redis stack", "docker", ["--version"], false),
      fileCheck("Web dependency lockfile", "web/package-lock.json"),
      fileCheck("Mobile dependency lockfile", "mobile/package-lock.json"),
    ],
  },
  {
    category: "Provider Credentials",
    checks: [
      envCheck("QuickBooks sandbox OAuth", ["QBO_CLIENT_ID", "QBO_CLIENT_SECRET", "QBO_REDIRECT_URI"], !ciMode),
      envCheck("Microsoft Graph OAuth", ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_REDIRECT_URI"], !ciMode),
      envCheck("RevenueCat entitlement webhooks", ["REVENUECAT_WEBHOOK_AUTHORIZATION", "REVENUECAT_ENTITLEMENT_KEY"], !ciMode),
      envCheck("Supabase JWT verification", ["SUPABASE_URL", "SUPABASE_JWKS_URL", "SUPABASE_JWT_ISSUER"], false),
      envCheck("OCR and AI providers", ["AWS_REGION", "OPENAI_API_KEY"], false),
    ],
  },
  {
    category: "Product Contracts",
    checks: [
      fileCheck("Commercial MVP snapshot", "docs/COMMERCIAL_MVP.md"),
      fileCheck("8/10 readiness plan", "docs/PRODUCT_8_OUT_OF_10_PLAN.md"),
      fileCheck("10/10 readiness plan", "docs/PRODUCT_10_OUT_OF_10_PLAN.md"),
      fileCheck("Security audit notes", "docs/SECURITY_AUDIT_NOTES.md"),
      fileCheck("OpenAPI contract", "docs/openapi.yaml"),
      fileCheck("Mobile release checklist", "docs/MOBILE_RELEASE_CHECKLIST.md"),
      fileCheck("Device QA matrix", "docs/DEVICE_QA_MATRIX.md"),
      fileCheck("Provider sandbox runbook", "docs/PROVIDER_SANDBOX_RUNBOOK.md"),
      fileCheck("Golden receipt smoke script", "scripts/smoke-receipt-flow.mjs"),
      fileCheck("Provider benchmark script", "scripts/provider-sandbox-benchmark.mjs"),
      fileCheck("CI quality-gates workflow", ".github/workflows/quality-gates.yml"),
      fileCheck("Provider benchmark workflow", ".github/workflows/provider-sandbox-benchmark.yml"),
    ],
  },
  {
    category: "Critical Implementation",
    checks: [
      fileCheck("QuickBooks service", "backend/app/services/quickbooks.py"),
      fileCheck("Microsoft Graph service", "backend/app/services/microsoft_graph.py"),
      fileCheck("Worker runner", "backend/app/services/worker_runner.py"),
      fileCheck("Mobile offline queue", "mobile/lib/offline-queue.ts"),
      fileCheck("Mobile capture screen", "mobile/app/(tabs)/capture.tsx"),
      fileCheck("Backend service tests", "backend/tests/test_receipts_service_logic.py"),
    ],
  },
];

const flatChecks = checks.flatMap((group) => group.checks.map((check) => ({ ...check, category: group.category })));
const blockerCount = flatChecks.filter((check) => check.status === "blocker").length;
const warnCount = flatChecks.filter((check) => check.status === "warn").length;
const passCount = flatChecks.filter((check) => check.status === "pass").length;

if (args.has("--json")) {
  process.stdout.write(
    `${JSON.stringify(
      {
        summary: { pass: passCount, warn: warnCount, blocker: blockerCount },
        checks,
      },
      null,
      2,
    )}\n`,
  );
} else {
  process.stdout.write("Receipt Tracker Launch Readiness\n");
  process.stdout.write(`Summary: ${passCount} pass, ${warnCount} warn, ${blockerCount} blocker\n\n`);
  for (const group of checks) {
    process.stdout.write(`${group.category}\n`);
    for (const check of group.checks) {
      process.stdout.write(`  [${statusIcon(check.status)}] ${check.label} - ${check.detail}\n`);
    }
    process.stdout.write("\n");
  }
  process.stdout.write("Run with --json for machine-readable output. Run with --strict to fail on blockers.\n");
  process.stdout.write("Use --ci to downgrade provider credential checks to warnings for automation runs.\n");
}

if (args.has("--strict") && blockerCount > 0) {
  process.exitCode = 1;
}

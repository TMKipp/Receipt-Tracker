import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const ciMode = args.has("--ci");
const productionMode = args.has("--production") || args.has("--prod");

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

function loadRawEnv() {
  const env = new Map();
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
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }
    env.set(normalizedKey, valueParts.join("=").trim());
  }
  return env;
}

const localEnv = loadLocalEnv();
const rawEnv = loadRawEnv();

function resolveEnvValue(key) {
  const runtimeValue = process.env[key];
  if (runtimeValue !== undefined && String(runtimeValue).trim()) {
    return String(runtimeValue).trim();
  }
  const fileValue = rawEnv.get(key);
  return fileValue ? String(fileValue).trim() : "";
}

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

function envPolicyCheck(
  label,
  key,
  predicate,
  {
    required = true,
    passDetail = "configured",
    failDetail = "does not satisfy policy",
    showValue = false,
  } = {},
) {
  const value = resolveEnvValue(key);
  if (!value) {
    return {
      label,
      status: required ? "blocker" : "warn",
      detail: `missing ${key}`,
    };
  }

  const pass = predicate(value);
  const failureDetail = showValue ? `${failDetail}; current=${value}` : failDetail;
  return {
    label,
    status: pass ? "pass" : required ? "blocker" : "warn",
    detail: pass ? passDetail : failureDetail,
  };
}

function statusIcon(status) {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "BLOCK";
}

const providerCredentialsRequired = productionMode || !ciMode;

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
      envCheck("QuickBooks sandbox OAuth", ["QBO_CLIENT_ID", "QBO_CLIENT_SECRET", "QBO_REDIRECT_URI"], providerCredentialsRequired),
      envCheck("Microsoft Graph OAuth", ["MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_REDIRECT_URI"], providerCredentialsRequired),
      envCheck("RevenueCat entitlement webhooks", ["REVENUECAT_WEBHOOK_AUTHORIZATION", "REVENUECAT_ENTITLEMENT_KEY"], providerCredentialsRequired),
      envCheck("Supabase JWT verification", ["SUPABASE_URL", "SUPABASE_JWKS_URL", "SUPABASE_JWT_ISSUER"], productionMode),
      envCheck("OCR and AI providers", ["AWS_REGION", "OPENAI_API_KEY"], false),
    ],
  },
  ...(productionMode
    ? [
        {
          category: "Production Hardening",
          checks: [
            envPolicyCheck("Environment mode", "APP_ENV", (value) => value.toLowerCase() === "production", {
              required: true,
              passDetail: "APP_ENV=production",
              failDetail: "APP_ENV must be set to production",
              showValue: true,
            }),
            envPolicyCheck(
              "App secret key strength",
              "APP_SECRET_KEY",
              (value) => value !== "replace-me" && value.length >= 32,
              {
                required: true,
                passDetail: "APP_SECRET_KEY configured with strong length",
                failDetail: "APP_SECRET_KEY must be non-default and at least 32 characters",
              },
            ),
            envPolicyCheck("Developer auth disabled", "DEV_AUTH_ENABLED", (value) => value.toLowerCase() === "false", {
              required: true,
              passDetail: "DEV_AUTH_ENABLED=false",
              failDetail: "DEV_AUTH_ENABLED must be false in production",
              showValue: true,
            }),
            envPolicyCheck("Inline sync disabled", "SYNC_RUN_INLINE", (value) => value.toLowerCase() === "false", {
              required: true,
              passDetail: "SYNC_RUN_INLINE=false",
              failDetail: "SYNC_RUN_INLINE must be false for production workers",
              showValue: true,
            }),
            envPolicyCheck(
              "Schema auto-create disabled",
              "APP_AUTO_CREATE_SCHEMA",
              (value) => value.toLowerCase() === "false",
              {
                required: true,
                passDetail: "APP_AUTO_CREATE_SCHEMA=false",
                failDetail: "APP_AUTO_CREATE_SCHEMA must be false in production",
                showValue: true,
              },
            ),
            envPolicyCheck("Storage provider", "STORAGE_PROVIDER", (value) => value.toLowerCase() === "s3", {
              required: true,
              passDetail: "STORAGE_PROVIDER=s3",
              failDetail: "STORAGE_PROVIDER must be s3 for production",
              showValue: true,
            }),
            envPolicyCheck("S3 bucket is not development default", "S3_BUCKET", (value) => value !== "receipt-tracker-dev", {
              required: true,
              passDetail: "S3 bucket configured for non-dev environment",
              failDetail: "S3_BUCKET is still the development default",
            }),
            envPolicyCheck(
              "Postgres DSN is not local",
              "POSTGRES_DSN",
              (value) => !/(localhost|127\.0\.0\.1)/i.test(value),
              {
                required: true,
                passDetail: "POSTGRES_DSN points to non-local database",
                failDetail: "POSTGRES_DSN appears to use localhost",
              },
            ),
            envPolicyCheck("Redis URL is not local", "REDIS_URL", (value) => !/(localhost|127\.0\.0\.1)/i.test(value), {
              required: true,
              passDetail: "REDIS_URL points to non-local cache",
              failDetail: "REDIS_URL appears to use localhost",
            }),
            envPolicyCheck(
              "QuickBooks base URL is production",
              "QBO_BASE_URL",
              (value) => !/sandbox-quickbooks/i.test(value),
              {
                required: true,
                passDetail: "QBO_BASE_URL points to production endpoint",
                failDetail: "QBO_BASE_URL still points to sandbox endpoint",
                showValue: true,
              },
            ),
            envPolicyCheck(
              "CORS origins are non-local",
              "BACKEND_CORS_ORIGINS",
              (value) => !/(localhost|127\.0\.0\.1)/i.test(value),
              {
                required: true,
                passDetail: "CORS origins are production-safe",
                failDetail: "BACKEND_CORS_ORIGINS still includes localhost origins",
                showValue: true,
              },
            ),
          ],
        },
      ]
    : []),
  {
    category: "Product Contracts",
    checks: [
      fileCheck("Commercial MVP snapshot", "docs/COMMERCIAL_MVP.md"),
      fileCheck("8/10 readiness plan", "docs/PRODUCT_8_OUT_OF_10_PLAN.md"),
      fileCheck("10/10 readiness plan", "docs/PRODUCT_10_OUT_OF_10_PLAN.md"),
      fileCheck("Production secrets checklist", "docs/PRODUCTION_SECRETS_CHECKLIST.md"),
      fileCheck("Security audit notes", "docs/SECURITY_AUDIT_NOTES.md"),
      fileCheck("OpenAPI contract", "docs/openapi.yaml"),
      fileCheck("Mobile release checklist", "docs/MOBILE_RELEASE_CHECKLIST.md"),
      fileCheck("Device QA matrix", "docs/DEVICE_QA_MATRIX.md"),
      fileCheck("Provider sandbox runbook", "docs/PROVIDER_SANDBOX_RUNBOOK.md"),
      fileCheck("Golden receipt smoke script", "scripts/smoke-receipt-flow.mjs"),
      fileCheck("Provider benchmark script", "scripts/provider-sandbox-benchmark.mjs"),
      fileCheck("CI quality-gates workflow", ".github/workflows/quality-gates.yml"),
      fileCheck("Provider benchmark workflow", ".github/workflows/provider-sandbox-benchmark.yml"),
      fileCheck("Production secrets workflow", ".github/workflows/production-secrets-verify.yml"),
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
  process.stdout.write("Use --production (or --prod) to enforce go-live security and config policies.\n");
}

if (args.has("--strict") && blockerCount > 0) {
  process.exitCode = 1;
}

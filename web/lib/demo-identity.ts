import type { DemoIdentity } from "@/lib/backend-api";

export function getDefaultDemoIdentity(): DemoIdentity {
  return {
    backendUrl: process.env.NEXT_PUBLIC_RECEIPT_API_BASE_URL || "http://localhost:8000/api/v1",
    demoEmail: process.env.NEXT_PUBLIC_RECEIPT_DEMO_EMAIL || "demo@example.com",
    demoName: process.env.NEXT_PUBLIC_RECEIPT_DEMO_NAME || "Demo User",
  };
}

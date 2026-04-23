export type CommercialReceipt = {
  id: string;
  vendor: string;
  date: string;
  amount: string;
  category: string;
  status: "review_required" | "approved" | "syncing" | "synced" | "failed";
  confidence: number;
  duplicateClear: boolean;
  quickbooks: "ready" | "queued" | "synced" | "failed";
  excel: "ready" | "queued" | "synced" | "failed";
  notes: string;
  decisionSummary: string[];
  lineItems: Array<{ name: string; amount: string; qty: string }>;
};

export const receipts: CommercialReceipt[] = [
  {
    id: "rcpt-1048",
    vendor: "Staples Chelsea",
    date: "Apr 15",
    amount: "$86.42",
    category: "Office Supplies",
    status: "review_required",
    confidence: 0.96,
    duplicateClear: true,
    quickbooks: "ready",
    excel: "ready",
    notes: "Shipping labels and toner for April client mailers.",
    decisionSummary: [
      "Mapped to Office Supplies from prior approved Staples receipts.",
      "Subtotal, tax, and total reconcile within policy.",
      "Auto-approve stayed off because the owner wants first-pass review.",
    ],
    lineItems: [
      { name: "HP 952XL black toner", amount: "$54.99", qty: "1" },
      { name: "Thermal label rolls", amount: "$18.40", qty: "2" },
      { name: "Binder clips", amount: "$5.99", qty: "1" },
    ],
  },
  {
    id: "rcpt-1047",
    vendor: "Delta Air Lines",
    date: "Apr 14",
    amount: "$412.18",
    category: "Travel",
    status: "approved",
    confidence: 0.94,
    duplicateClear: true,
    quickbooks: "queued",
    excel: "ready",
    notes: "Atlanta owner-operator meetup and client walkthrough.",
    decisionSummary: [
      "Flight vendor history points to Travel.",
      "Manual note added for business purpose before export.",
      "Ready to post as a reimbursable-style owner expense.",
    ],
    lineItems: [
      { name: "Main cabin fare", amount: "$338.00", qty: "1" },
      { name: "Seat selection", amount: "$35.96", qty: "1" },
    ],
  },
  {
    id: "rcpt-1046",
    vendor: "Blue Bottle Bryant Park",
    date: "Apr 13",
    amount: "$24.71",
    category: "Meals & Entertainment",
    status: "synced",
    confidence: 0.98,
    duplicateClear: true,
    quickbooks: "synced",
    excel: "synced",
    notes: "Coffee meeting before walkthrough scheduling.",
    decisionSummary: [
      "Vendor history exceeded auto-approve threshold.",
      "QuickBooks and Excel payloads matched the approved values exactly.",
      "Receipt image is attached to the expense trail.",
    ],
    lineItems: [
      { name: "Drip coffee", amount: "$9.50", qty: "2" },
      { name: "Butter croissant", amount: "$4.25", qty: "1" },
      { name: "Vanilla latte", amount: "$9.00", qty: "1" },
    ],
  },
  {
    id: "rcpt-1045",
    vendor: "Home Depot 1274",
    date: "Apr 11",
    amount: "$148.33",
    category: "Other Business Expense",
    status: "syncing",
    confidence: 0.91,
    duplicateClear: true,
    quickbooks: "queued",
    excel: "queued",
    notes: "Patch, rollers, and trim supplies for turnover work.",
    decisionSummary: [
      "Thermal paper softened several SKU names, but total confidence stayed high.",
      "Excel row is staged while the QuickBooks attachment worker finishes.",
      "This is a good example of why the review lane stays visible.",
    ],
    lineItems: [
      { name: "Patch kit", amount: "$21.99", qty: "1" },
      { name: "Paint roller set", amount: "$18.29", qty: "1" },
      { name: "Interior paint", amount: "$73.98", qty: "2" },
    ],
  },
];

export const launchMetrics = [
  { label: "Median processing", value: "6.8 sec", context: "after upload completion" },
  { label: "First sync time", value: "4 min", context: "new user to posted expense" },
  { label: "Auto-approved", value: "31%", context: "only after trust conditions clear" },
];

export const monthlyBuckets = [
  {
    month: "April 2026",
    total: "$4,716",
    categories: [
      { name: "Office Supplies", share: "27%", total: "$1,284" },
      { name: "Travel", share: "19%", total: "$892" },
      { name: "Meals & Entertainment", share: "9%", total: "$436" },
      { name: "Other Business Expense", share: "45%", total: "$2,104" },
    ],
  },
  {
    month: "March 2026",
    total: "$4,229",
    categories: [
      { name: "Repairs", share: "38%", total: "$1,607" },
      { name: "Travel", share: "24%", total: "$1,015" },
      { name: "Software", share: "13%", total: "$540" },
      { name: "Meals", share: "8%", total: "$329" },
    ],
  },
];

export const integrationHealth = {
  quickbooks: {
    status: "connected",
    detail: "Sandbox realm connected and account map imported this morning.",
  },
  excel: {
    status: "connected",
    detail: "Workbook pinned to `Expenses_2026` with row append validation active.",
  },
  syncReadyTargets: ["quickbooks", "excel"],
};

export const launchChecklist = [
  "Supabase auth with Apple, Google, and Microsoft enabled",
  "RevenueCat trial wall live on iOS and Android",
  "QuickBooks vendor import and expense attachment worker verified",
  "Excel workbook binding and retry panel verified",
  "Support macros, privacy copy, and beta onboarding email drafted",
];

export const pricingRows = [
  {
    label: "14-day trial",
    detail: "Unlimited capture during onboarding with full QuickBooks and Excel setup.",
  },
  {
    label: "$24 / month",
    detail: "Single-business owner-operator plan with mobile capture, web review, and exports.",
  },
  {
    label: "Beta cohort",
    detail: "White-glove migration help and weekly product feedback sessions.",
  },
];

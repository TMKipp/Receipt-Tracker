export type MobileReceipt = {
  id: string;
  vendor: string;
  total: string;
  date: string;
  category: string;
  status: "queued_offline" | "processing" | "review_required" | "approved" | "synced";
  notes: string;
  confidence: number;
  decisionSummary: string[];
  lineItems: Array<{ label: string; amount: string }>;
};

export const receipts: MobileReceipt[] = [
  {
    id: "rcpt-1048",
    vendor: "Staples Chelsea",
    total: "$86.42",
    date: "Apr 15",
    category: "Office Supplies",
    status: "review_required",
    notes: "Shipping labels and toner for April client mailers.",
    confidence: 0.96,
    decisionSummary: [
      "Mapped from prior approved Staples receipts.",
      "Totals reconcile and duplicate guard is clear.",
      "Manual review is still required before first sync.",
    ],
    lineItems: [
      { label: "HP 952XL black toner", amount: "$54.99" },
      { label: "Thermal label rolls", amount: "$18.40" },
      { label: "Binder clips", amount: "$5.99" },
    ],
  },
  {
    id: "rcpt-1047",
    vendor: "Delta Air Lines",
    total: "$412.18",
    date: "Apr 14",
    category: "Travel",
    status: "approved",
    notes: "Atlanta meetup and client walkthrough.",
    confidence: 0.94,
    decisionSummary: [
      "Travel category matched prior flight history.",
      "Business-purpose note added before sync.",
    ],
    lineItems: [
      { label: "Main cabin fare", amount: "$338.00" },
      { label: "Seat selection", amount: "$35.96" },
    ],
  },
  {
    id: "rcpt-1046",
    vendor: "Blue Bottle Bryant Park",
    total: "$24.71",
    date: "Apr 13",
    category: "Meals & Entertainment",
    status: "synced",
    notes: "Coffee meeting before walkthrough scheduling.",
    confidence: 0.98,
    decisionSummary: [
      "Vendor history exceeded auto-approve threshold.",
      "QuickBooks and Excel both posted successfully.",
    ],
    lineItems: [
      { label: "Drip coffee", amount: "$9.50" },
      { label: "Croissant", amount: "$4.25" },
      { label: "Vanilla latte", amount: "$9.00" },
    ],
  },
];

export const queueItems = [
  { id: "queue-001", label: "Lobby paint supply run", state: "queued offline" },
  { id: "queue-002", label: "Airport parking receipt", state: "uploading" },
  { id: "queue-003", label: "Coffee meeting copy", state: "processing" },
];

export const metrics = [
  { label: "Awaiting review", value: "14" },
  { label: "Queued offline", value: "3" },
  { label: "This month", value: "$4,716" },
];

export const reportBuckets = [
  { month: "April", amount: "$4,716", delta: "+12%" },
  { month: "March", amount: "$4,229", delta: "+4%" },
  { month: "February", amount: "$3,881", delta: "-3%" },
];

"use client";

import { useEffect, useMemo, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ActionToastStack, type ActionToast } from "@/components/action-toast-stack";
import { MobileAppPreview } from "@/components/mobile-app-preview";
import { monthlyBuckets } from "@/lib/mock-data";

type ReportFocus = "spend" | "sync" | "review";

const reportFocuses: Array<{ id: ReportFocus; label: string }> = [
  { id: "spend", label: "Spend" },
  { id: "sync", label: "Sync" },
  { id: "review", label: "Review" },
];

function parseMonthIndex(value: string | null) {
  const nextIndex = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(nextIndex) || nextIndex < 0 || nextIndex >= monthlyBuckets.length) {
    return 0;
  }
  return nextIndex;
}

function parseFocus(value: string | null): ReportFocus {
  if (value === "sync" || value === "review") {
    return value;
  }
  return "spend";
}

export function AppReportsWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [monthIndex, setMonthIndex] = useState(() => parseMonthIndex(searchParams.get("month")));
  const [focus, setFocus] = useState<ReportFocus>(() => parseFocus(searchParams.get("focus")));
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") ?? monthlyBuckets[0].categories[0]?.name ?? "");
  const [toasts, setToasts] = useState<ActionToast[]>([]);

  const currentMonth = monthlyBuckets[monthIndex];
  const activeCategory =
    currentMonth.categories.find((category) => category.name === selectedCategory) ?? currentMonth.categories[0];

  const summaryCards = useMemo(() => {
    if (focus === "sync") {
      return [
        { label: "QuickBooks success", value: "98%", detail: "Approved receipts posting cleanly" },
        { label: "Excel success", value: "97%", detail: "Workbook table still matches" },
        { label: "Retries waiting", value: "2", detail: "Visible before support is needed" },
      ];
    }

    if (focus === "review") {
      return [
        { label: "Needs review", value: "14", detail: "Receipts still waiting on a decision" },
        { label: "High confidence", value: "31%", detail: "Automation still gated" },
        { label: "Duplicate guard", value: "Clear", detail: "No active collisions" },
      ];
    }

    return [
      { label: "Month total", value: currentMonth.total, detail: "Approved spend so far" },
      { label: "Largest category", value: activeCategory.name, detail: activeCategory.share },
      { label: "Selected category", value: activeCategory.total, detail: "Current focus" },
    ];
  }, [activeCategory, currentMonth, focus]);

  const focusPanel = useMemo(() => {
    if (focus === "sync") {
      return {
        title: "Sync health",
        detail: "Use this view to catch failed posts before they become accounting drift.",
        rows: [
          { label: "QuickBooks", value: "98% success" },
          { label: "Excel", value: "97% success" },
          { label: "Retry window", value: "< 5 min" },
          { label: "Next action", value: "Open failed posts" },
        ],
      };
    }

    if (focus === "review") {
      return {
        title: "Review pressure",
        detail: "Use this view to see where human review is still doing real work.",
        rows: [
          { label: "Manual saves", value: "31%" },
          { label: "Queue age", value: "14 min" },
          { label: "Top vendor", value: "Staples" },
          { label: "Next action", value: "Resolve oldest review" },
        ],
      };
    }

    return {
      title: "Spend view",
      detail: "Use this view to see what changed this month and where the money is moving.",
      rows: [
        { label: "Month", value: currentMonth.month },
        { label: "Category total", value: activeCategory.total },
        { label: "Category share", value: activeCategory.share },
        { label: "Next action", value: "Watch category trend" },
      ],
    };
  }, [activeCategory, currentMonth.month, focus]);

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function pushToast(title: string, detail: string, tone: ActionToast["tone"] = "neutral") {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, title, detail, tone }].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  useEffect(() => {
    const nextMonth = parseMonthIndex(searchParams.get("month"));
    const nextFocus = parseFocus(searchParams.get("focus"));
    const nextCategory = searchParams.get("category") ?? "";

    if (nextMonth !== monthIndex) {
      setMonthIndex(nextMonth);
    }
    if (nextFocus !== focus) {
      setFocus(nextFocus);
    }

    const fallbackCategory = monthlyBuckets[nextMonth].categories[0]?.name ?? "";
    if ((nextCategory || fallbackCategory) !== selectedCategory) {
      setSelectedCategory(nextCategory || fallbackCategory);
    }
  }, [focus, monthIndex, searchParams, selectedCategory]);

  useEffect(() => {
    if (!currentMonth.categories.some((category) => category.name === selectedCategory)) {
      setSelectedCategory(currentMonth.categories[0]?.name ?? "");
    }
  }, [currentMonth, selectedCategory]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (monthIndex === 0) {
      params.delete("month");
    } else {
      params.set("month", String(monthIndex));
    }

    if (focus === "spend") {
      params.delete("focus");
    } else {
      params.set("focus", focus);
    }

    if (selectedCategory) {
      params.set("category", selectedCategory);
    } else {
      params.delete("category");
    }

    const next = params.toString();
    const current = searchParams.toString();

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [focus, monthIndex, pathname, router, searchParams, selectedCategory]);

  return (
    <div className="app-workspace-grid">
      <section className="app-workspace-main">
        <div className="app-surface-header">
          <div>
            <p className="pane-label">Reports</p>
            <h2>See what changed and what needs attention.</h2>
            <p>Use this screen to answer one question fast: what changed, and do I need to act on it?</p>
          </div>
          <span className={`status-pill ${focus === "sync" ? "status-neutral" : focus === "review" ? "status-warn" : "status-good"}`}>
            {focus === "sync" ? "Sync view" : focus === "review" ? "Review view" : "Spend view"}
          </span>
        </div>

        <div className="app-report-toolbar">
          <div className="app-filter-chips" role="tablist" aria-label="Months">
            {monthlyBuckets.map((bucket, index) => (
              <button
                key={bucket.month}
                type="button"
                className={index === monthIndex ? "is-active" : undefined}
                onClick={() => {
                  setMonthIndex(index);
                  pushToast("Month changed", `${bucket.month} is now the active month.`, "neutral");
                }}
              >
                {bucket.month}
              </button>
            ))}
          </div>
          <div className="app-filter-chips" role="tablist" aria-label="Report focus">
            {reportFocuses.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === focus ? "is-active" : undefined}
                onClick={() => {
                  setFocus(entry.id);
                  pushToast("Focus updated", `${entry.label} view is active.`, entry.id === "review" ? "warn" : "neutral");
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="app-report-strip">
          {summaryCards.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>

        <div className="app-report-panels">
          <section className="app-review-card app-review-card-soft">
            <span className="pane-label">{focusPanel.title}</span>
            <h3>{focusPanel.detail}</h3>
            <div className="app-review-detail-list">
              {focusPanel.rows.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="app-review-card app-review-card-soft">
            <span className="pane-label">Selected category</span>
            <h3>{activeCategory.name}</h3>
            <div className="app-review-detail-list">
              <div>
                <span>Month</span>
                <strong>{currentMonth.month}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{activeCategory.total}</strong>
              </div>
              <div>
                <span>Share</span>
                <strong>{activeCategory.share}</strong>
              </div>
              <div>
                <span>Current lens</span>
                <strong>{focus === "sync" ? "Sync impact" : focus === "review" ? "Review impact" : "Spend trend"}</strong>
              </div>
            </div>
          </section>
        </div>

        <div className="app-category-bars">
          <div className="app-category-bars-header">
            <div>
              <span className="pane-label">Category mix</span>
              <h3>{currentMonth.month}</h3>
            </div>
            <strong>{currentMonth.total}</strong>
          </div>
          <div className="app-category-bar-list">
            {currentMonth.categories.map((category) => (
              <button
                key={category.name}
                type="button"
                className={`app-category-bar-button ${category.name === activeCategory.name ? "is-active" : ""}`.trim()}
                onClick={() => {
                  setSelectedCategory(category.name);
                  pushToast("Category focused", `${category.name} is now the selected category.`, "good");
                }}
              >
                <div className="app-category-bar-copy">
                  <span>{category.name}</span>
                  <strong>{category.total}</strong>
                </div>
                <div className="app-category-bar-track">
                  <div className="app-category-bar-fill" style={{ width: category.share }} />
                </div>
                <small>{category.share} of month total</small>
              </button>
            ))}
          </div>
        </div>

        <div className="app-primary-actions app-primary-actions-bar">
          <button type="button" onClick={() => pushToast("Summary exported", `${currentMonth.month} is staged for export.`, "good")}>
            Export summary
          </button>
          <button
            type="button"
            onClick={() => {
              setFocus("sync");
              pushToast("Sync exceptions opened", "The reports view moved into sync health.", "warn");
            }}
          >
            Open sync exceptions
          </button>
        </div>
      </section>

      <aside className="app-workspace-side">
        <div className="app-mobile-mirror">
          <div className="app-mobile-mirror-header">
            <div>
              <span className="pane-label">Phone mirror</span>
              <strong>{focus === "review" ? "Review pressure on mobile" : focus === "sync" ? "Sync posture on mobile" : "Spending on mobile"}</strong>
            </div>
            <small>{currentMonth.month}</small>
          </div>
          <MobileAppPreview mode={focus === "review" ? "review" : "queue"} />
        </div>
        <div className="app-side-note">
          <span className="pane-label">Simple rule</span>
          <p>Show the number, explain what it means, and make the next action easy to spot.</p>
        </div>
      </aside>
      <ActionToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

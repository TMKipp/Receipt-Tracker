"use client";

import { useEffect, useMemo, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ActionToastStack, type ActionToast } from "@/components/action-toast-stack";
import { MobileAppPreview } from "@/components/mobile-app-preview";
import { monthlyBuckets } from "@/lib/mock-data";

type ReportFocus = "spend" | "sync" | "review";

const reportFocuses: Array<{ id: ReportFocus; label: string }> = [
  { id: "spend", label: "Spend view" },
  { id: "sync", label: "Sync health" },
  { id: "review", label: "Review pressure" },
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

  const reportLines = useMemo(() => {
    if (focus === "sync") {
      return [
        { label: "QuickBooks success", value: "98%", detail: "Approved receipts posting cleanly" },
        { label: "Excel success", value: "97%", detail: "Pinned workbook still matches the row contract" },
        { label: "Retry posture", value: "2 waiting", detail: "Visible failures before support is needed" },
      ];
    }

    if (focus === "review") {
      return [
        { label: "Needs review", value: "14", detail: "Receipts still waiting on an owner trust decision" },
        { label: "High confidence", value: "31%", detail: "Automation still gated behind approval policy" },
        { label: "Duplicate guard", value: "Clear", detail: "No active collisions in the current queue" },
      ];
    }

    return [
      { label: "Month-to-date spend", value: currentMonth.total, detail: "Visible spend after approved receipts" },
      { label: "Largest category", value: activeCategory.name, detail: `${activeCategory.share} of this month is concentrated here` },
      { label: "Selected category", value: activeCategory.total, detail: "Useful when review pressure and spend stay attached" },
    ];
  }, [activeCategory, currentMonth, focus]);

  const focusStory = useMemo(() => {
    if (focus === "sync") {
      return {
        title: "The reporting layer is tied to sync trust, not decorative charts.",
        detail: "Failures stay visible next to the spend they affect, so the owner never has to guess whether the books are actually up to date.",
        stats: [
          { label: "QuickBooks success", value: "98%" },
          { label: "Excel success", value: "97%" },
          { label: "Retry window", value: "< 5 min" },
        ],
      };
    }

    if (focus === "review") {
      return {
        title: `${activeCategory.name} is where manual trust work still matters most.`,
        detail: "The owner should see where confidence softens, where duplicate checks matter, and where a quick edit saves the sync path from churn.",
        stats: [
          { label: "Manual saves", value: "31%" },
          { label: "Review age", value: "14 min" },
          { label: "Top vendor pattern", value: "Staples" },
        ],
      };
    }

    return {
      title: `${activeCategory.name} is driving ${currentMonth.month}.`,
      detail: "Spend is only useful when it stays tied to the operating story: which merchants rose, what synced cleanly, and where review still protects the books.",
      stats: [
        { label: "Category share", value: activeCategory.share },
        { label: "Category total", value: activeCategory.total },
        { label: "Spend freshness", value: "Live" },
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
            <h2>See spending, sync health, and review pressure</h2>
            <p>Use this screen to answer one question quickly: what changed, and does it need action?</p>
          </div>
          <span className={`status-pill ${focus === "sync" ? "status-neutral" : focus === "review" ? "status-warn" : "status-good"}`}>
            {focus === "sync" ? "Sync view" : focus === "review" ? "Review view" : "Reporting live"}
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
                  pushToast("Month changed", `${bucket.month} is now the active reporting window.`, "neutral");
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
                  pushToast("Focus updated", `${entry.label} is now shaping the reporting story.`, entry.id === "review" ? "warn" : "neutral");
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="app-report-strip">
          {reportLines.map((line) => (
            <article key={line.label}>
              <span>{line.label}</span>
              <strong>{line.value}</strong>
              <p>{line.detail}</p>
            </article>
          ))}
        </div>

        <div className="app-review-details-grid">
          <section className="app-review-card">
            <span className="pane-label">What this view means</span>
            <h3>{focusStory.title}</h3>
            <p>{focusStory.detail}</p>
            <div className="app-review-detail-list">
              {focusStory.stats.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="app-review-card">
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
                <span>Share of spend</span>
                <strong>{activeCategory.share}</strong>
              </div>
              <div>
                <span>Next action</span>
                <strong>{focus === "sync" ? "Check failed posts" : focus === "review" ? "Resolve reviews" : "Watch category trend"}</strong>
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
                  pushToast("Category focused", `${category.name} is now the active reporting lens.`, "good");
                }}
              >
                <div className="app-category-bar-copy">
                  <span>{category.name}</span>
                  <strong>{category.total}</strong>
                </div>
                <div className="app-category-bar-track">
                  <div className="app-category-bar-fill" style={{ width: category.share }} />
                </div>
                <small>{category.share} of month-to-date spend</small>
              </button>
            ))}
          </div>
        </div>

        <div className="app-account-actions">
          <button
            type="button"
            onClick={() => pushToast("Summary exported", `${currentMonth.month} is staged for CSV and PDF export.`, "good")}
          >
            Export summary
          </button>
          <button
            type="button"
            onClick={() => {
              setFocus("sync");
              pushToast("Sync exceptions opened", "The reporting view shifted into sync health so failures stay visible.", "warn");
            }}
          >
            Open sync exceptions
          </button>
          <button
            type="button"
            onClick={() => pushToast("Month pinned", `${currentMonth.month} stays pinned in this workspace until you change it.`, "neutral")}
          >
            Pin this month
          </button>
        </div>
      </section>

      <aside className="app-workspace-side">
        <div className="app-mobile-mirror">
          <div className="app-mobile-mirror-header">
            <div>
              <span className="pane-label">Phone mirror</span>
              <strong>{focus === "review" ? "Review pressure on mobile" : focus === "sync" ? "Sync posture on mobile" : "Spending story on mobile"}</strong>
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

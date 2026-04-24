"use client";

import type { ReactNode } from "react";

import { startTransition, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type OperatorAppShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  meta?: ReactNode;
};

const appNavItems = [
  { href: "/app", label: "Inbox", cue: "Approve receipts" },
  { href: "/app/capture", label: "Capture", cue: "Upload receipts" },
  { href: "/app/reports", label: "Reports", cue: "Track spending" },
  { href: "/app/account", label: "Account", cue: "Settings and billing" },
];

const workspaceProfiles: Record<
  string,
  {
    label: string;
    guidance: string;
    steps: string[];
  }
> = {
  "/app": {
    label: "Review receipts",
    guidance: "Open the next receipt, check the key fields, then approve it.",
    steps: ["Pick the next receipt", "Check vendor, date, total, and category", "Approve and sync"],
  },
  "/app/capture": {
    label: "Capture and upload",
    guidance: "Add a receipt, keep it safe while it uploads, then hand it to review.",
    steps: ["Capture or import", "Wait for upload", "Send to review"],
  },
  "/app/reports": {
    label: "Understand spending",
    guidance: "See what was spent, what synced, and what still needs attention.",
    steps: ["Choose a month", "Focus on spend or sync", "Investigate exceptions"],
  },
  "/app/account": {
    label: "Manage settings",
    guidance: "Keep billing, integrations, and automation healthy.",
    steps: ["Check billing", "Confirm integrations", "Adjust automation"],
  },
};

const commandActions = [
  {
    id: "go-inbox",
    title: "Open inbox",
    detail: "Review receipts waiting for approval.",
    keywords: ["inbox", "review", "receipts", "queue"],
    href: "/app",
  },
  {
    id: "go-capture",
    title: "Open capture",
    detail: "Capture or upload a new receipt.",
    keywords: ["capture", "camera", "upload", "library"],
    href: "/app/capture",
  },
  {
    id: "go-reports",
    title: "Open reports",
    detail: "See spending, sync health, and review pressure.",
    keywords: ["reports", "spend", "totals", "sync"],
    href: "/app/reports",
  },
  {
    id: "go-account",
    title: "Open account",
    detail: "Check billing and integration settings.",
    keywords: ["account", "billing", "integrations", "settings"],
    href: "/app/account",
  },
  {
    id: "go-support",
    title: "Open support",
    detail: "See recovery and escalation paths.",
    keywords: ["support", "recovery", "help", "failed syncs"],
    href: "/support",
  },
];

export function OperatorAppShell({ title, description, children, meta }: OperatorAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = appNavItems.find((item) => item.href === pathname) ?? appNavItems[0];
  const activeProfile = workspaceProfiles[pathname] ?? workspaceProfiles["/app"];
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  const filteredActions = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return commandActions;
    }

    return commandActions.filter((action) =>
      [action.title, action.detail, ...action.keywords].some((value) => value.toLowerCase().includes(query)),
    );
  }, [commandQuery]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!commandOpen) {
      setCommandQuery("");
    }
  }, [commandOpen]);

  function handleCommandSelect(href: string) {
    setCommandOpen(false);
    setCommandQuery("");
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <div className="operator-app-page">
      <div className="operator-app-shell operator-app-shell-simple">
        <aside className="operator-app-rail">
          <div className="operator-app-brand-row">
            <div className="operator-app-brand-mark">LL</div>
            <div className="operator-app-brand">
              <p>Ledger Lens</p>
              <span>Receipt tracking made obvious</span>
            </div>
          </div>

          <nav className="operator-app-nav" aria-label="App sections">
            {appNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href} className={isActive ? "is-active" : undefined}>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.cue}</small>
                  </div>
                  <span aria-hidden="true">{isActive ? "ON" : "GO"}</span>
                </Link>
              );
            })}
          </nav>

          <div className="operator-app-focus">
            <span className="pane-label">Today</span>
            <strong>{activeProfile.label}</strong>
            <p>{activeProfile.guidance}</p>
          </div>

          <div className="operator-app-rail-footer">
            <Link href="/support">Support center</Link>
            <Link href="/onboarding">Finish setup</Link>
          </div>
        </aside>

        <div className="operator-app-main">
          <header className="operator-app-header operator-app-header-simple">
            <div className="operator-app-heading">
              <p className="pane-label">Ledger Lens app</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>

            <div className="operator-app-header-actions">
              <button type="button" className="operator-app-command-trigger" onClick={() => setCommandOpen(true)}>
                Search
              </button>
              <span className="status-pill status-good">Trial active</span>
              <Link href="/app/capture">Upload receipt</Link>
            </div>
          </header>

          {meta ? <div className="operator-app-meta operator-app-meta-simple">{meta}</div> : null}

          <main className="operator-app-content">{children}</main>
        </div>
      </div>

      {commandOpen ? (
        <div className="operator-command-overlay" role="presentation" onClick={() => setCommandOpen(false)}>
          <div
            className="operator-command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="operator-command-header">
              <span className="pane-label">Command</span>
              <button type="button" onClick={() => setCommandOpen(false)}>
                Esc
              </button>
            </div>
            <label className="operator-command-search">
              <input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Search pages and workflows"
                aria-label="Search commands"
              />
            </label>
            <div className="operator-command-results">
              {filteredActions.map((action) => (
                <button key={action.id} type="button" onClick={() => handleCommandSelect(action.href)}>
                  <div>
                    <strong>{action.title}</strong>
                    <small>{action.detail}</small>
                  </div>
                  <span>Open</span>
                </button>
              ))}
              {filteredActions.length === 0 ? (
                <div className="operator-command-empty">
                  <strong>No matching commands</strong>
                  <small>Try searching for inbox, capture, reports, or account.</small>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

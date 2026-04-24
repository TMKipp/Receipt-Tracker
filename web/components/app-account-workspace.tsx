"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ActionToastStack, type ActionToast } from "@/components/action-toast-stack";
import { MobileAppPreview } from "@/components/mobile-app-preview";
import {
  bindExcelWorkbook,
  getBillingSnapshot,
  getIntegrationHealth,
  listMicrosoftWorkbookTables,
  searchMicrosoftWorkbooks,
  type BillingSnapshotResponse,
  type IntegrationHealthResponse,
  type MicrosoftWorkbookCandidate,
  type MicrosoftWorkbookTable,
} from "@/lib/backend-api";
import { getDefaultDemoIdentity } from "@/lib/demo-identity";

type AccountPane = "readiness" | "billing" | "automation";

const defaultDemoIdentity = getDefaultDemoIdentity();
const accountPanes: Array<{ id: AccountPane; label: string }> = [
  { id: "readiness", label: "Setup" },
  { id: "billing", label: "Billing" },
  { id: "automation", label: "Automation" },
];
const excelTemplateColumns = ["Vendor", "Date", "Total", "Category", "Tax", "Payment Method", "Notes", "Receipt ID"];

function parsePane(value: string | null): AccountPane {
  if (value === "billing" || value === "automation") {
    return value;
  }
  return "readiness";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Not yet recorded";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function trimWorkbookPath(path: string | null) {
  if (!path) {
    return "OneDrive or SharePoint";
  }
  return path.replace(/^\/drives\/[^/]+\/root:/, "").replace(/^:/, "") || "Root folder";
}

function excelTableReadiness(table: MicrosoftWorkbookTable | null) {
  if (!table) {
    return {
      label: "Waiting",
      tone: "status-neutral",
      detail: "Choose a table to preview its receipt-column compatibility.",
    };
  }
  if (table.sync_ready) {
    return {
      label: "Ready",
      tone: "status-good",
      detail: `${table.supported_columns.length} supported columns detected.`,
    };
  }
  if (table.supported_columns.length > 0) {
    return {
      label: "Partial",
      tone: "status-warn",
      detail: `Usable, but missing ${table.missing_recommended_columns.join(", ")}.`,
    };
  }
  return {
    label: "Needs columns",
    tone: "status-bad",
    detail: "Add supported columns before binding this table.",
  };
}

export function AppAccountWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pane, setPane] = useState<AccountPane>(() => parsePane(searchParams.get("pane")));
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(searchParams.get("autoApprove") === "on");
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealthResponse | null>(null);
  const [billingSnapshot, setBillingSnapshot] = useState<BillingSnapshotResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [workbooks, setWorkbooks] = useState<MicrosoftWorkbookCandidate[]>([]);
  const [tables, setTables] = useState<MicrosoftWorkbookTable[]>([]);
  const [selectedWorkbook, setSelectedWorkbook] = useState<MicrosoftWorkbookCandidate | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [searchMessage, setSearchMessage] = useState("Search by workbook name and choose the file the business already uses.");
  const [lastAction, setLastAction] = useState("Pin one Excel table so approved receipts have a clear destination.");
  const [toasts, setToasts] = useState<ActionToast[]>([]);

  const quickbooksConnected = integrationHealth?.quickbooks.status === "connected";
  const microsoftConnected = integrationHealth?.microsoft.status === "connected";
  const workbookBinding = billingSnapshot?.workbook_binding ?? integrationHealth?.workbook_binding ?? null;

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

  async function refreshAccountData() {
    try {
      const [integrationResponse, billingResponse] = await Promise.all([
        getIntegrationHealth(defaultDemoIdentity),
        getBillingSnapshot(defaultDemoIdentity),
      ]);
      setIntegrationHealth(integrationResponse);
      setBillingSnapshot(billingResponse);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load account health.");
    }
  }

  useEffect(() => {
    void refreshAccountData();
  }, []);

  useEffect(() => {
    const nextPane = parsePane(searchParams.get("pane"));
    const nextAutoApprove = searchParams.get("autoApprove") === "on";
    if (nextPane !== pane) {
      setPane(nextPane);
    }
    if (nextAutoApprove !== autoApproveEnabled) {
      setAutoApproveEnabled(nextAutoApprove);
    }
  }, [autoApproveEnabled, pane, searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (pane === "readiness") {
      params.delete("pane");
    } else {
      params.set("pane", pane);
    }
    if (autoApproveEnabled) {
      params.set("autoApprove", "on");
    } else {
      params.delete("autoApprove");
    }

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [autoApproveEnabled, pane, pathname, router, searchParams]);

  const readinessScore = useMemo(() => {
    let score = 42;
    if (quickbooksConnected) score += 24;
    if (microsoftConnected) score += 18;
    if (workbookBinding) score += 12;
    if (autoApproveEnabled) score += 4;
    return Math.min(score, 100);
  }, [autoApproveEnabled, microsoftConnected, quickbooksConnected, workbookBinding]);

  const selectedTable = tables.find((item) => item.table_id === selectedTableId) ?? null;
  const selectedTableReadiness = excelTableReadiness(selectedTable);
  const selectedTableCanBind = Boolean(selectedTable && selectedTable.supported_columns.length > 0);

  async function handleWorkbookSearch() {
    setIsSearching(true);
    setSearchMessage("Searching Microsoft 365 for Excel files you can already access...");
    try {
      const results = await searchMicrosoftWorkbooks(defaultDemoIdentity, searchQuery, 8);
      setWorkbooks(results.data);
      setSelectedWorkbook(null);
      setTables([]);
      setSelectedTableId(null);
      setSearchMessage(
        results.data.length > 0
          ? "Choose the workbook that should receive approved receipt rows."
          : "No matching workbooks were found. Try a broader file name search.",
      );
      setLastAction(results.data.length > 0 ? "Workbook search returned matching Excel files." : "Workbook search returned no matches.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Workbook search failed.";
      setSearchMessage(detail);
      pushToast("Workbook search failed", detail, "warn");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSelectWorkbook(workbook: MicrosoftWorkbookCandidate) {
    setSelectedWorkbook(workbook);
    setSelectedTableId(null);
    setTables([]);
    setSearchMessage(`Loading tables from ${workbook.name}...`);
    try {
      const response = await listMicrosoftWorkbookTables(defaultDemoIdentity, workbook.drive_id, workbook.item_id);
      setTables(response.data);
      setSearchMessage(
        response.data.length > 0
          ? "Choose the table that should receive approved receipt rows."
          : "This workbook has no Graph-visible tables yet. Add a table in Excel first.",
      );
      setLastAction(`Loaded ${response.data.length} tables from ${workbook.name}.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unable to inspect workbook tables.";
      setSearchMessage(detail);
      pushToast("Table lookup failed", detail, "warn");
    }
  }

  async function handleBindWorkbook() {
    if (!selectedWorkbook || !selectedTable) {
      pushToast("Choose a workbook and table", "Select the workbook first, then pick the table to bind.", "warn");
      return;
    }
    if (!selectedTableCanBind) {
      pushToast(
        "Table needs receipt columns",
        "Add a supported column such as Vendor, Date, Total, Category, Tax, or Notes before pinning this Excel table.",
        "warn",
      );
      return;
    }

    setIsBinding(true);
    try {
      await bindExcelWorkbook(defaultDemoIdentity, {
        driveId: selectedWorkbook.drive_id,
        itemId: selectedWorkbook.item_id,
        tableId: selectedTable.table_id,
        workbookName: selectedWorkbook.name,
        worksheetName: selectedTable.worksheet_name,
        tableName: selectedTable.table_name,
      });
      await refreshAccountData();
      setLastAction(`Excel is now pinned to ${selectedWorkbook.name} / ${selectedTable.table_name}.`);
      pushToast("Excel connected", "Approved receipts can now append into the selected workbook table.", "good");
    } catch (error) {
      pushToast("Workbook bind failed", error instanceof Error ? error.message : "Unable to bind the workbook.", "warn");
    } finally {
      setIsBinding(false);
    }
  }

  const setupSteps = [
    {
      label: "QuickBooks",
      value: quickbooksConnected ? "Connected" : "Connect first",
      detail: quickbooksConnected
        ? integrationHealth?.quickbooks.external_tenant_name || "Accounting target ready"
        : "Connect QuickBooks so approved receipts can create expenses.",
    },
    {
      label: "Microsoft",
      value: microsoftConnected ? "Connected" : "Connect first",
      detail: microsoftConnected
        ? integrationHealth?.microsoft.external_tenant_name || "Excel search ready"
        : "Connect Microsoft before searching for workbooks.",
    },
    {
      label: "Excel table",
      value: workbookBinding ? "Pinned" : "Choose table",
      detail: workbookBinding
        ? `${workbookBinding.workbook_name || "Workbook"} / ${workbookBinding.table_name || "Table"}`
        : "Search a workbook, then pick the table that should receive new rows.",
    },
  ];

  return (
    <div className="app-workspace-grid">
      <section className="app-workspace-main">
        <div className="app-surface-header">
          <div>
            <p className="pane-label">Account</p>
            <h2>Finish setup and keep access healthy.</h2>
            <p>Connect QuickBooks, choose an Excel table, and manage billing or automation without extra guesswork.</p>
          </div>
          <span className={`status-pill ${readinessScore >= 80 ? "status-good" : "status-neutral"}`}>{readinessScore}% ready</span>
        </div>

        <div className="app-report-toolbar">
          <div className="app-filter-chips" role="tablist" aria-label="Account sections">
            {accountPanes.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === pane ? "is-active" : undefined}
                onClick={() => setPane(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {loadError ? <div className="app-inline-message app-inline-message-warn">{loadError}</div> : null}

        {pane === "readiness" ? (
          <>
            <div className="app-setup-progress">
              {setupSteps.map((step) => (
                <article key={step.label} className="app-setup-step-card">
                  <span>{step.label}</span>
                  <strong>{step.value}</strong>
                  <p>{step.detail}</p>
                </article>
              ))}
            </div>

            <div className="app-account-lower app-account-lower-tight">
              <div className="app-checklist-panel">
                <div className="app-checklist-header">
                  <div>
                    <span className="pane-label">Search workbook</span>
                    <h3>Use the Excel file you already work in</h3>
                  </div>
                  <strong>{workbookBinding ? "Excel ready" : "Setup in progress"}</strong>
                </div>

                <div className="app-workbook-search">
                  <label className="app-search-shell">
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search workbook name, like Expenses 2026"
                      aria-label="Search Excel workbooks"
                    />
                    <strong>Excel</strong>
                  </label>
                  <div className="app-primary-actions">
                    <button type="button" onClick={handleWorkbookSearch} disabled={!microsoftConnected || isSearching}>
                      {isSearching ? "Searching..." : "Search workbooks"}
                    </button>
                    <Link href="/settings/integrations">Open full integrations</Link>
                  </div>
                  <p className="app-inline-help">{searchMessage}</p>
                </div>

                <div className="app-workbook-results">
                  {workbooks.map((workbook) => (
                    <button
                      key={`${workbook.drive_id}-${workbook.item_id}`}
                      type="button"
                      className={`app-selection-item ${selectedWorkbook?.item_id === workbook.item_id ? "is-selected" : ""}`.trim()}
                      onClick={() => void handleSelectWorkbook(workbook)}
                    >
                      <div className="app-selection-item-copy">
                        <strong>{workbook.name}</strong>
                        <small>{trimWorkbookPath(workbook.path)}</small>
                      </div>
                      <div className="app-selection-item-meta">
                        <span>{formatTimestamp(workbook.last_modified_at)}</span>
                        <small>{workbook.mime_type || "Excel file"}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="app-health-panel">
                <div className="app-checklist-header">
                  <div>
                    <span className="pane-label">Choose table</span>
                    <h3>Pick the exact table for new receipt rows</h3>
                  </div>
                  <strong>{selectedWorkbook ? selectedWorkbook.name : "No workbook selected"}</strong>
                </div>

                <div className="app-review-detail-list">
                  <div>
                    <span>Current binding</span>
                    <strong>{workbookBinding?.table_name || "Nothing pinned yet"}</strong>
                  </div>
                  <div>
                    <span>Selected workbook</span>
                    <strong>{selectedWorkbook?.name || "Choose one from search results"}</strong>
                  </div>
                  <div>
                    <span>Last action</span>
                    <strong>{selectedTable ? selectedTable.table_name : "Waiting for selection"}</strong>
                  </div>
                  <div>
                    <span>Table readiness</span>
                    <strong>{selectedTableReadiness.label}</strong>
                  </div>
                </div>

                <div className="app-table-list">
                  {tables.map((table) => (
                    <button
                      key={table.table_id}
                      type="button"
                      className={`app-selection-item ${selectedTableId === table.table_id ? "is-selected" : ""}`.trim()}
                      onClick={() => setSelectedTableId(table.table_id)}
                    >
                      <div className="app-selection-item-copy">
                        <strong>{table.table_name}</strong>
                        <small>{table.worksheet_name || "Worksheet name unavailable"}</small>
                        <div className="app-column-chip-row">
                          {(table.supported_columns.length ? table.supported_columns : ["No supported columns"]).slice(0, 5).map((column) => (
                            <span key={column}>{column}</span>
                          ))}
                        </div>
                      </div>
                      <div className="app-selection-item-meta">
                        <span className={`status-pill ${excelTableReadiness(table).tone}`}>{excelTableReadiness(table).label}</span>
                        <small>
                          {table.columns.length} {table.columns.length === 1 ? "column" : "columns"}
                        </small>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedWorkbook && tables.length === 0 ? (
                  <div className="app-inline-message app-inline-message-warn">
                    <strong>No Excel tables found</strong>
                    <p>
                      Open the workbook in Excel, select the receipt columns, choose Insert &gt; Table, then search again.
                    </p>
                  </div>
                ) : null}

                <div className="app-excel-template-card">
                  <div>
                    <span className="pane-label">Recommended columns</span>
                    <strong>Use these headers for the cleanest live append.</strong>
                  </div>
                  <div className="app-column-chip-row">
                    {excelTemplateColumns.map((column) => (
                      <span key={column}>{column}</span>
                    ))}
                  </div>
                  {selectedTable ? (
                    <p className={selectedTable.sync_ready ? "app-readiness-copy-good" : "app-readiness-copy-warn"}>
                      {selectedTableReadiness.detail}
                    </p>
                  ) : (
                    <p>These map directly to the approved receipt payload and keep CSV export aligned with live Excel sync.</p>
                  )}
                </div>

                <div className="app-primary-actions">
                  <button type="button" onClick={handleBindWorkbook} disabled={!selectedWorkbook || !selectedTableCanBind || isBinding}>
                    {isBinding ? "Saving..." : "Use this Excel table"}
                  </button>
                </div>

                <div className="app-inline-message">
                  <strong>Why this matters</strong>
                  <p>{lastAction}</p>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {pane === "billing" ? (
          <div className="app-account-lower app-account-lower-tight">
            <div className="app-checklist-panel">
              <div className="app-checklist-header">
                <div>
                  <span className="pane-label">Billing</span>
                  <h3>Keep trial and restore access obvious</h3>
                </div>
                <strong>{billingSnapshot?.entitlement.active ? "Access active" : "Needs attention"}</strong>
              </div>
              <div className="app-review-detail-list">
                <div>
                  <span>Trial status</span>
                  <strong>{billingSnapshot?.entitlement.active ? "Active" : "Paywall required"}</strong>
                </div>
                <div>
                  <span>Days remaining</span>
                  <strong>{billingSnapshot?.entitlement.trial_days_remaining ?? 0}</strong>
                </div>
                <div>
                  <span>Entitlement</span>
                  <strong>{billingSnapshot?.entitlement.entitlement?.status || "Not provisioned"}</strong>
                </div>
                <div>
                  <span>Latest event</span>
                  <strong>{formatTimestamp(billingSnapshot?.entitlement.entitlement?.latest_event_at)}</strong>
                </div>
              </div>
              <div className="app-primary-actions">
                <Link href="/billing">Open billing workspace</Link>
                <Link href="/restore-access">Open restore access</Link>
              </div>
            </div>

            <div className="app-health-panel">
              <div className="app-checklist-header">
                <div>
                  <span className="pane-label">Keep visible</span>
                  <h3>Make the commercial state easy to understand</h3>
                </div>
              </div>
              <div className="app-review-story-list">
                {[
                  "Show trial runway before the paywall becomes a surprise.",
                  "Keep restore access visible inside the product, not just in email.",
                  "Never hide whether sync is blocked by billing or by setup.",
                ].map((item) => (
                  <article key={item}>
                    <span aria-hidden="true" />
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {pane === "automation" ? (
          <div className="app-account-lower app-account-lower-tight">
            <div className="app-checklist-panel">
              <div className="app-checklist-header">
                <div>
                  <span className="pane-label">Automation</span>
                  <h3>Only automate what is easy to trust</h3>
                </div>
                <strong>{autoApproveEnabled ? "Guarded on" : "Review first"}</strong>
              </div>
              <div className="app-review-story-list">
                {[
                  "Only turn on auto-approve after onboarding is complete.",
                  "Require vendor history, duplicate-clear state, and mapped accounts.",
                  "Keep manual review one tap away.",
                ].map((item) => (
                  <article key={item}>
                    <span aria-hidden="true" />
                    <p>{item}</p>
                  </article>
                ))}
              </div>
              <div className="app-primary-actions">
                <button
                  type="button"
                  onClick={() => {
                    const next = !autoApproveEnabled;
                    setAutoApproveEnabled(next);
                    setLastAction(
                      next
                        ? "Auto-approve was enabled, but it still depends on vendor history, duplicate checks, and mapped accounts."
                        : "Auto-approve was disabled so every receipt returns to manual review.",
                    );
                    pushToast(
                      next ? "Auto-approve enabled" : "Auto-approve disabled",
                      next ? "Automation is active behind visible guardrails." : "The workflow returned to owner review first.",
                      next ? "good" : "warn",
                    );
                  }}
                >
                  {autoApproveEnabled ? "Return to review-first" : "Enable guarded auto-approve"}
                </button>
              </div>
            </div>

            <div className="app-health-panel">
              <div className="app-checklist-header">
                <div>
                  <span className="pane-label">Dependencies</span>
                  <h3>Automation only helps when the path is ready</h3>
                </div>
              </div>
              <div className="app-review-detail-list">
                <div>
                  <span>Mode</span>
                  <strong>{autoApproveEnabled ? "Guarded on" : "Review first"}</strong>
                </div>
                <div>
                  <span>QuickBooks</span>
                  <strong>{quickbooksConnected ? "Available" : "Connect first"}</strong>
                </div>
                <div>
                  <span>Excel</span>
                  <strong>{workbookBinding ? "Pinned" : "Choose table"}</strong>
                </div>
                <div>
                  <span>Last change</span>
                  <strong>{lastAction}</strong>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="app-workspace-side">
        <div className="app-mobile-mirror">
          <div className="app-mobile-mirror-header">
            <div>
              <span className="pane-label">Phone mirror</span>
              <strong>{pane === "billing" ? "Billing on mobile" : pane === "automation" ? "Automation on mobile" : "Setup on mobile"}</strong>
            </div>
            <small>{workbookBinding ? "Excel ready" : "Setup in progress"}</small>
          </div>
          <MobileAppPreview mode={pane === "automation" ? "review" : "queue"} />
        </div>
        <div className="app-side-note">
          <span className="pane-label">Simple rule</span>
          <p>Connect QuickBooks, choose the Excel file you already use, and keep the commercial state visible.</p>
        </div>
      </aside>
      <ActionToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

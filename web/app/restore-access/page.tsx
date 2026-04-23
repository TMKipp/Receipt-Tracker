import Link from "next/link";

import { AppNav } from "@/components/app-nav";

const restoreSteps = [
  {
    title: "Confirm the billing account",
    detail: "Make sure the owner is restoring the correct RevenueCat-backed subscription record.",
  },
  {
    title: "Reconnect blocked sync actions",
    detail: "Once access is restored, new QuickBooks and Excel sync attempts should become available immediately.",
  },
  {
    title: "Keep history visible",
    detail: "Even during interruption, the receipt archive and review context should stay readable.",
  },
];

const restoreReasons = [
  "Trial ended before the first real sync proved the value.",
  "Payment method needs attention, but the owner still needs the audit trail.",
  "Support wants one clean surface for recovery instead of ad hoc billing copy.",
];

export default function RestoreAccessPage() {
  return (
    <div className="marketing-page">
      <AppNav />
      <main className="simple-page auth-page">
        <section className="auth-layout">
          <article className="panel auth-panel auth-panel-primary">
            <p className="kicker">Restore access</p>
            <h1>When billing gets in the way, recovery should still feel orderly.</h1>
            <p className="section-intro">
              The recovery surface should be explicit about what is paused, what is still visible, and what the owner
              gets back the moment access is restored.
            </p>
            <div className="timeline-list">
              {restoreSteps.map((step) => (
                <article key={step.title} className="timeline-item is-active">
                  <div className="timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="action-link-row">
              <Link href="/billing">Open billing posture</Link>
              <Link href="/login" className="secondary">
                Return to sign in
              </Link>
            </div>
          </article>

          <article className="panel auth-panel">
            <div className="pane-heading">
              <div>
                <p className="pane-label">Why this page exists</p>
                <h2>Billing recovery is part of the product design</h2>
              </div>
            </div>
            <div className="insight-list">
              {restoreReasons.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div className="detail-pairs">
              <div>
                <span>Paused</span>
                <strong>New sync attempts</strong>
              </div>
              <div>
                <span>Still visible</span>
                <strong>Receipt archive and history</strong>
              </div>
              <div>
                <span>Best outcome</span>
                <strong>Restore and resume without confusion</strong>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

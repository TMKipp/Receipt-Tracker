import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { launchChecklist, launchMetrics } from "@/lib/mock-data";

const firstRunJourney = [
  {
    step: "01",
    title: "Connect the accounting stack",
    detail: "QuickBooks and Microsoft should be configured in one calm setup path, not scattered through settings.",
  },
  {
    step: "02",
    title: "Capture one real receipt",
    detail: "The owner should see the actual photo-to-review flow immediately, not an abstract product tour.",
  },
  {
    step: "03",
    title: "Approve with confidence",
    detail: "Vendor, date, total, and category stay up front so the trust decision is fast and obvious.",
  },
  {
    step: "04",
    title: "Watch it post cleanly",
    detail: "The first sync should prove the whole commercial promise in a single moment.",
  },
];

const productPrinciples = [
  "Review lane first. The owner should never have to dig for the fields that determine trust.",
  "Connection truth stays visible. Billing and integration health should always explain what might block value.",
  "Every automated action remains explainable, reversible, and attached to an audit trail.",
];

export default function LaunchPage() {
  return (
    <div className="marketing-page">
      <AppNav />
      <main>
        <section className="hero-band">
          <div className="hero-copy">
            <p className="kicker">For U.S. owner-operators</p>
            <h1>Turn a loose receipt into a posted expense without making the owner babysit the process.</h1>
            <p>
              Ledger Lens pairs mobile capture, a disciplined review lane, and clear sync visibility so the product
              feels trustworthy before the subscription even becomes a question.
            </p>
            <div className="hero-actions">
              <Link href="/app">Open the app workspace</Link>
              <Link href="/onboarding" className="secondary">
                Start the setup flow
              </Link>
            </div>
          </div>

          <div className="hero-poster">
            <div className="poster-head">
              <span>First-run target</span>
              <strong>One clean sync in under 5 minutes</strong>
            </div>
            <div className="poster-stack">
              {firstRunJourney.slice(0, 3).map((item) => (
                <article key={item.step}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <span>{item.step}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="metric-band">
          {launchMetrics.map((metric) => (
            <article key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.context}</p>
            </article>
          ))}
        </section>

        <section className="journey-grid">
          {firstRunJourney.map((item) => (
            <article key={item.step} className="panel journey-card">
              <span className="journey-step">{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="workspace-grid-two marketing-grid-gap">
          <article className="panel">
            <div className="pane-heading">
              <div>
                <p className="pane-label">Product principles</p>
                <h2>Design choices that make the MVP feel more expensive than it is.</h2>
              </div>
            </div>
            <div className="insight-list">
              {productPrinciples.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="pane-heading">
              <div>
                <p className="pane-label">Launch readiness</p>
                <h2>Everything the beta needs before the app stores do.</h2>
              </div>
            </div>
            <div className="launch-checklist">
              {launchChecklist.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </article>
        </section>

        <section className="pricing-preview">
          <div>
            <p className="kicker">Commercial path</p>
            <h2>One offer. One activation story. One reason to trust the product.</h2>
          </div>
          <div className="pricing-table">
            <article>
              <strong>14-day trial</strong>
              <p>Enough time to connect the stack, post the first receipt, and prove the workflow before renewal.</p>
            </article>
            <article>
              <strong>$24 / month</strong>
              <p>Owner-operator launch pricing with mobile capture, web review, and both accounting sync targets.</p>
            </article>
            <article>
              <strong>Launch mindset</strong>
              <p>Keep the packaging simple so the product earns the subscription through execution, not pricing gymnastics.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

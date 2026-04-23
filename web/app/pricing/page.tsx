import Link from "next/link";

import { AppNav } from "@/components/app-nav";

const launchPlan = [
  "Native mobile capture with review queue and offline-minded workflow",
  "QuickBooks Online sync with receipt-backed expense records",
  "Live Excel append plus CSV export fallback",
  "Owner-operator web companion for review, settings, billing, and support visibility",
];

const honestEdges = [
  "One plan at launch keeps the choice simple and the support path clear.",
  "The trial should prove value through one real sync, not through feature overload.",
  "If billing lapses, new syncs pause, but audit history remains visible.",
];

export default function PricingPage() {
  return (
    <div className="marketing-page">
      <AppNav />
      <main className="simple-page">
        <section className="simple-header">
          <p className="kicker">Launch pricing</p>
          <h1>Price the MVP like an operational tool, not a complicated software catalog.</h1>
          <p>
            The commercial launch keeps one clear offer on the table: a two-week trial, one owner-operator plan,
            and a product that needs to earn its keep through fast setup and clean accounting outcomes.
          </p>
        </section>

        <section className="pricing-grid">
          <article className="panel pricing-card pricing-card-accent">
            <p className="pane-label">Owner-operator plan</p>
            <h2>$24 / month</h2>
            <p className="section-intro">14-day free trial. One business. Full capture, review, sync, and export workflow.</p>
            <div className="inclusion-list">
              {launchPlan.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div className="action-link-row">
              <Link href="/onboarding">See the setup flow</Link>
              <Link href="/billing" className="secondary">
                Review billing surface
              </Link>
            </div>
          </article>

          <article className="panel pricing-card">
            <p className="pane-label">Commercial posture</p>
            <h2>Keep the offer honest.</h2>
            <div className="insight-list">
              {honestEdges.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </article>
        </section>

        <section className="workspace-grid-two marketing-grid-gap">
          <article className="panel">
            <div className="pane-heading">
              <div>
                <p className="pane-label">Trial story</p>
                <h2>What should happen before renewal</h2>
              </div>
            </div>
            <div className="detail-pairs">
              <div>
                <span>Day 1</span>
                <strong>Connect QuickBooks and pin Excel</strong>
              </div>
              <div>
                <span>First proof</span>
                <strong>Capture and sync one real receipt</strong>
              </div>
              <div>
                <span>Before renewal</span>
                <strong>Show time saved and sync reliability</strong>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="pane-heading">
              <div>
                <p className="pane-label">What the price buys</p>
                <h2>Less bookkeeping friction, more trust in the close</h2>
              </div>
            </div>
            <p className="section-note">
              The product does not need a giant pricing matrix to feel premium. It needs a believable promise, a clean
              first-run experience, and an obvious path from captured paper to posted expense.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

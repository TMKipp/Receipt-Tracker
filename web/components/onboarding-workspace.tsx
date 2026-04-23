import Link from "next/link";

const setupSteps = [
  {
    step: "01",
    title: "Connect QuickBooks",
    detail: "Import the chart of accounts first so categorization suggestions stay constrained to what the owner already uses.",
  },
  {
    step: "02",
    title: "Pin the Excel workbook",
    detail: "Choose one workbook and one table so the live sync story is precise, predictable, and easy to support.",
  },
  {
    step: "03",
    title: "Capture the first receipt",
    detail: "The app should prove extraction, review, and approval on a real image before the owner sees any billing pressure.",
  },
  {
    step: "04",
    title: "Post the first sync",
    detail: "Show the successful QuickBooks and Excel outcomes right away so the product earns trust in under five minutes.",
  },
];

const trustRules = [
  "Auto-approve stays off until onboarding is complete and vendor history is established.",
  "Every sync should show what fields were used and whether the posting target is healthy.",
  "CSV export remains available as a safety valve even when live sync is the default story.",
];

const launchHabits = [
  "Use one clean sample receipt during setup so the first success feels fast and understandable.",
  "Keep billing and integration status visible during onboarding so the owner knows what could block value.",
  "Treat the first sync as the real activation moment, not the sign-up form.",
];

const customerPromises = [
  "A receipt should never disappear between capture and review, even when the device goes offline.",
  "Every automated suggestion should explain what fields were used and how to undo it.",
  "Billing should never hide historical data or make prior synced work unreadable.",
];

const launchStandards = [
  "New owner to first posted receipt in under five minutes.",
  "QuickBooks and Excel connection health visible before the first sync.",
  "Support and restore-access paths reachable without leaving the product.",
];

export function OnboardingWorkspace() {
  return (
    <div className="workspace-stack">
      <section className="panel panel-emphasis">
        <div className="pane-heading">
          <div>
            <p className="pane-label">First five minutes</p>
            <h2>Design setup so the product proves itself immediately.</h2>
          </div>
          <span>Goal: first successful sync in under 5 minutes</span>
        </div>
        <p className="section-intro">
          The onboarding surface should feel like a guided operating brief. It is not a wizard for the sake of a wizard;
          it exists to get the owner to one trustworthy posted receipt as quickly as possible.
        </p>
        <div className="setup-ladder">
          {setupSteps.map((item) => (
            <article key={item.step} className="setup-step">
              <div className="setup-step-index">{item.step}</div>
              <div className="setup-step-copy">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Trust rules</p>
              <h2>What the owner should never have to guess</h2>
            </div>
          </div>
          <div className="insight-list">
            {trustRules.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Launch habits</p>
              <h2>Small behaviors that improve activation</h2>
            </div>
          </div>
          <div className="insight-list">
            {launchHabits.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </article>
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Next moves</p>
              <h2>Guide the owner into the real product</h2>
            </div>
          </div>
          <div className="action-link-row">
            <Link href="/settings/integrations">Connect integrations</Link>
            <Link href="/receipts" className="secondary">
              Open receipt lane
            </Link>
            <Link href="/billing" className="secondary">
              Review billing posture
            </Link>
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Outcome</p>
              <h2>The setup flow should sell the subscription on its own</h2>
            </div>
          </div>
          <p className="section-note">
            If the owner can connect accounts, capture one receipt, and watch it post cleanly, the paywall stops feeling
            like a gamble and starts feeling earned.
          </p>
        </article>
      </section>

      <section className="workspace-grid-two">
        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Customer promises</p>
              <h2>What the product should guarantee from day one</h2>
            </div>
          </div>
          <div className="insight-list">
            {customerPromises.map((promise) => (
              <p key={promise}>{promise}</p>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="pane-heading">
            <div>
              <p className="pane-label">Launch standards</p>
              <h2>What has to feel true before public release</h2>
            </div>
          </div>
          <div className="insight-list">
            {launchStandards.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

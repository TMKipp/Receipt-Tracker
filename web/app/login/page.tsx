import Link from "next/link";

import { AppNav } from "@/components/app-nav";

const authOptions = [
  {
    provider: "Continue with Apple",
    detail: "Fastest path on iPhone for owner-operators already living on mobile.",
  },
  {
    provider: "Continue with Google",
    detail: "Good default for shared business email and quick mobile-to-web handoff.",
  },
  {
    provider: "Continue with Microsoft",
    detail: "Best fit when Excel sync is central to the customer’s workflow from day one.",
  },
  {
    provider: "Sign in with email",
    detail: "Reliable fallback for accounts that want a simple password-based path.",
  },
];

const trustNotes = [
  "QuickBooks and Microsoft access are connected only after the user authorizes them.",
  "Receipt history stays readable even when billing or sync access changes.",
  "The first-run goal is still one clean posted receipt in under five minutes.",
];

export default function LoginPage() {
  return (
    <div className="marketing-page">
      <AppNav />
      <main className="simple-page auth-page">
        <section className="auth-layout">
          <article className="panel auth-panel auth-panel-primary">
            <p className="kicker">Sign in</p>
            <h1>Enter the product through a calm, credible front door.</h1>
            <p className="section-intro">
              Authentication should feel like the start of getting work done, not a detour. The user should understand
              why each sign-in path exists and what happens next.
            </p>
            <div className="auth-option-list">
              {authOptions.map((option) => (
                <button key={option.provider} type="button" className="auth-option">
                  <strong>{option.provider}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
            <div className="action-link-row">
              <Link href="/onboarding">See the first-run flow</Link>
              <Link href="/pricing" className="secondary">
                Review launch pricing
              </Link>
            </div>
          </article>

          <article className="panel auth-panel">
            <div className="pane-heading">
              <div>
                <p className="pane-label">Trust notes</p>
                <h2>What the user should understand before continuing</h2>
              </div>
            </div>
            <div className="insight-list">
              {trustNotes.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
            <div className="detail-pairs">
              <div>
                <span>Best first move</span>
                <strong>Connect accounting after sign-in</strong>
              </div>
              <div>
                <span>Activation moment</span>
                <strong>First successful sync</strong>
              </div>
              <div>
                <span>Support promise</span>
                <strong>No mystery states</strong>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

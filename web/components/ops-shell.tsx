import type { ReactNode } from "react";

import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { LaunchProgressRibbon } from "@/components/launch-progress-ribbon";

type OpsShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  rail?: ReactNode;
};

export function OpsShell({ eyebrow, title, description, children, rail }: OpsShellProps) {
  return (
    <div className="ops-page">
      <AppNav />
      <LaunchProgressRibbon />
      <div className="ops-frame">
        <aside className="ops-sidebar">
          <p className="ops-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="ops-sidebar-links">
            <Link href="/onboarding">Plan first run</Link>
            <Link href="/receipts">Open receipt lane</Link>
            <Link href="/settings/integrations">Review integrations</Link>
            <Link href="/billing">Check trial state</Link>
            <Link href="/support">Open support center</Link>
          </div>
          {rail ? <div className="ops-sidebar-rail">{rail}</div> : null}
        </aside>
        <main className="ops-main">{children}</main>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/launch", label: "Launch" },
  { href: "/onboarding", label: "Setup" },
  { href: "/receipts", label: "Receipts" },
  { href: "/reports", label: "Reports" },
  { href: "/support", label: "Support" },
  { href: "/pricing", label: "Pricing" },
  { href: "/billing", label: "Billing" },
  { href: "/settings/integrations", label: "Integrations" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="site-nav">
      <div className="site-nav-brand">
        <p>Ledger Lens</p>
        <span>Commercial MVP workspace</span>
      </div>
      <nav className="site-nav-links" aria-label="Primary">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));

          return (
            <Link key={link.href} href={link.href} className={isActive ? "is-active" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="site-nav-actions">
        <Link href="/login" className={pathname === "/login" ? "is-active" : undefined}>
          Sign in
        </Link>
        <Link href="/app" className="site-nav-cta">
          Open app
        </Link>
      </div>
    </header>
  );
}

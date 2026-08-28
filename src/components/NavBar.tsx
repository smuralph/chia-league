"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/seasons", label: "Seasons" },
  { href: "/managers", label: "Managers" },
  { href: "/rivalries", label: "Rivalries" },
  { href: "/ask", label: "Ask" },
];

function isLinkActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-bold text-lg whitespace-nowrap overflow-hidden text-ellipsis block flex-1 min-w-0 md:flex-initial"
          style={{ color: "var(--foreground)" }}
          onClick={() => setMenuOpen(false)}
        >
          🏈 Chia's Battle for the Sword
        </Link>

        {/* Laptop/iPad (md and up): full link row, unchanged */}
        <nav className="hidden md:flex gap-6 text-sm font-medium shrink-0">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: "var(--text-secondary)",
                textDecoration: isLinkActive(pathname, link.href) ? "underline" : "none",
                textUnderlineOffset: 4,
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Phone (below md): hamburger toggle */}
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden shrink-0 rounded p-2"
          style={{ color: "var(--foreground)" }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            {menuOpen ? (
              <path d="M4 4L18 18M18 4L4 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <>
                <path d="M3 6H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M3 11H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M3 16H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav
          className="md:hidden flex flex-col gap-1 px-6 pb-4 text-sm font-medium border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="py-2"
              style={{
                color: "var(--text-secondary)",
                textDecoration: isLinkActive(pathname, link.href) ? "underline" : "none",
                textUnderlineOffset: 4,
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

import Link from "next/link";

export function NavBar() {
  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <Link href="/" className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
        🏈 Chia's Battle for the Sword
      </Link>
      <nav className="flex gap-6 text-sm font-medium">
        <Link href="/" style={{ color: "var(--text-secondary)" }}>
          Home
        </Link>
        <Link href="/about" style={{ color: "var(--text-secondary)" }}>
          About
        </Link>
        <Link href="/seasons" style={{ color: "var(--text-secondary)" }}>
          Seasons
        </Link>
        <Link href="/managers" style={{ color: "var(--text-secondary)" }}>
          Managers
        </Link>
        <Link href="/rivalries" style={{ color: "var(--text-secondary)" }}>
          Rivalries
        </Link>
      </nav>
    </header>
  );
}

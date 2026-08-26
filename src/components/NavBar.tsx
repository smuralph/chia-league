import Link from "next/link";

export function NavBar() {
  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <Link href="/" className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
        🏈 Chia League
      </Link>
      <nav className="flex gap-6 text-sm font-medium">
        <Link href="/" style={{ color: "var(--text-secondary)" }}>
          Home
        </Link>
        <Link href="/seasons" style={{ color: "var(--text-secondary)" }}>
          Seasons
        </Link>
      </nav>
    </header>
  );
}

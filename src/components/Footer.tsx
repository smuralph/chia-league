export function Footer() {
  return (
    <footer className="border-t px-6 py-6 mt-auto" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs max-w-5xl mx-auto text-center" style={{ color: "var(--text-muted)" }}>
        Owner-vs-owner comparisons across the site (career rankings, KPIs) use seasons 2018–2026, since every current
        owner has been in the league for all of those seasons. Full league history goes back to 2014 - browse it
        season-by-season on the Seasons tab, or manager-by-manager on the Managers tab.
      </p>
    </footer>
  );
}

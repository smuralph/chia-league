import Link from "next/link";
import { CurrentSeasonPreviewCharts } from "@/components/CurrentSeasonPreviewCharts";
import { getCurrentSeasonPreviewData } from "@/lib/queries";

export default async function CurrentSeasonPreviewPage() {
  const data = await getCurrentSeasonPreviewData(2026);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <Link href="/seasons/2026" className="text-sm" style={{ color: "var(--primary)" }}>
          ← Back to 2026 season
        </Link>
        <h1 className="text-3xl font-bold mt-2" style={{ color: "var(--foreground)" }}>
          Current Season Chart Preview
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Preliminary Week 1 concepts using the current season data.
        </p>
      </div>
      <CurrentSeasonPreviewCharts {...data} />
    </main>
  );
}

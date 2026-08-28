import { getTeamNameCloud } from "@/lib/queries";
import { TeamNameCloud } from "@/components/TeamNameCloud";
import { AskChat } from "@/components/AskChat";

export default async function AskPage() {
  const teamNames = await getTeamNameCloud();

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
      <TeamNameCloud
        names={teamNames}
        title="Chia's Battle for the Sword"
        subtitle="League at a Glance · 2018 – 2026"
        sizeScale={1.65}
        maxHeight={577}
      />

      {/* The overlap-over-the-word-cloud look only works with room to spare -
          on phones it crowds the title box and clips the input, so it's a
          normal stacked layout below md and only overlaps at md and up. */}
      <div className="relative z-10 md:mx-10 md:-mt-40">
        <AskChat />
      </div>

      <div className="rounded-lg border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          Brotherly PSA
        </h3>
        <div className="flex flex-col gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          <p>A couple things before y'all start blaming the LLM 😂:</p>
          <p>
            <strong style={{ color: "var(--foreground)" }}>1. WAIT FOR YOUR DAMN ANSWER.</strong>
            <br />
            This is the free version, not Skynet with a fiber connection. Sometimes it's gonna take 15–20+ seconds.
            Take a sip of your beer. Stretch your legs. Reflect on your life choices. Your answer is coming.
          </p>
          <p>
            <strong style={{ color: "var(--foreground)" }}>2. Get a "HIGH DEMAND" error?</strong>
            <br />
            Don't panic. Don't text me. Don't declare the AI broken. Just ask the question again. 😂
          </p>
          <p>
            Remember: FREE LLM.
            <br />
            You get what you pay for—and in this case, you paid $0.00.
          </p>
          <p>
            So be patient, retry when necessary, and for the love of God, don't complain about the response time.
            You've known me for 20+ years. You should already know I'm not fixing it. 😂
          </p>
        </div>
      </div>
    </main>
  );
}

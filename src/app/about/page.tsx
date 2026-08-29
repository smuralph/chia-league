import Image from "next/image";

export default function AboutPage() {
  return (
    <main className="about-page flex-1 w-full ">
      <section className="about-scene mx-auto relative overflow-hidden">
        <div className="about-scene__backdrop" aria-hidden="true" />

        <div className="about-page__content max-w-5xl mx-auto flex flex-col gap-6 relative z-10 py-8 px-4 sm:px-6">
          <div className="about-hero-visual mx-auto">
            <div className="about-portrait-wrap">
              <Image
                src="/about/chia.jpg"
                alt="Chia"
                width={180}
                height={144}
                className="about-portrait rounded-lg border object-cover"
                style={{ borderColor: "rgba(255,255,255,0.24)" }}
              />
            </div>
          </div>

          <article className="about-card max-w-3xl mx-auto flex flex-col gap-4 text-sm leading-relaxed">
            <h2 className="text-4xl font-bold text-center mb-2" style={{ color: "#f5f5f4" }}>
              The Legend of Chia
            </h2>

            <p>Long before fantasy football. Long before the NFL. Long before anyone knew what a waiver wire was, there was Chia.</p>

            <p>
              Legend tells us that Chia descended from a distinguished lineage of sporting hounds whose ancestors walked
              alongside warriors, kings, and champions. Some say the bloodline can be traced back centuries—to the
              ancient ball courts of Mesoamerica, where warriors battled for glory in games of strength, strategy, and
              honor. There, among the sacred courts, the ancestors of Chia were revered not merely as dogs, but as
              companions of champions, protectors of warriors, and the original Top Dogs of the sporting world.
            </p>

            <p>Generations later, that legendary spirit found its way to a far less civilized arena: fantasy football.</p>

            <p>
              It was here that Misael Rubio became the keeper of Chia's legacy. And when the time came to establish this
              league, there was only one fitting name.
            </p>

            <p className="text-center text-base font-semibold" style={{ color: "#ffffff" }}>
              The Chia Fantasy Football League.
            </p>

            <p>
              Today, every matchup played in this league carries a piece of that ancient legacy. Every victory adds
              another chapter. Every championship strengthens the bloodline. Every devastating loss to a rival is simply
              another tale passed down through generations.
            </p>

            <p>The managers may change. The teams may change. The players may retire.</p>

            <p className="text-center text-base font-semibold" style={{ color: "#ffffff" }}>
              But Chia endures.
            </p>

            <p className="text-center">So when you draft your team, remember what you're playing for.</p>

            <p className="text-center">Not just a championship.</p>
            <p className="text-center">Not just bragging rights.</p>

            <p className="text-center text-base font-semibold" style={{ color: "#ffffff" }}>
              You're playing for Chia.
            </p>

            <p className="text-center">
              The original Top Dog.
              <br />
              The legendary namesake.
              <br />
              The guardian of fantasy football glory.
            </p>

            <p className="text-center italic mt-2">May Chia's spirit guide your draft. 🐕🏆</p>
          </article>
        </div>
      </section>
    </main>
  );
}

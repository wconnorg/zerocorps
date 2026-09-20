import { ActivityPreview } from "@/components/marketing/activity-preview";
import { ProgressChart } from "@/components/marketing/progress-chart";
import { BrandName } from "@/components/site/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { site } from "@/config/site";

// Placeholder copy throughout: edit freely.

const PILLARS = [
  {
    number: "01",
    title: "Lessons in order",
    body: "Courses break into modules, and modules into lessons. Each one builds on the last, so you always know what to study next.",
  },
  {
    number: "02",
    title: "Ranks you earn",
    body: "Your rank is calculated from the lessons you complete. Progress is the only way up.",
  },
  {
    number: "03",
    title: "Discord, unlocked by rank",
    body: "Link your Discord account and your rank becomes a role. Higher ranks open more of the ZeroCorps server. Linking is optional.",
  },
];

function ArrowRight() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function AcademyCta() {
  return (
    <ButtonLink href="/academy" size="lg">
      Enter the Academy
      <ArrowRight />
    </ButtonLink>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid-fade" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-20 pb-24 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-28 lg:pb-32">
          <div>
            <p className="font-mono text-xs tracking-[0.22em] text-muted">
              <BrandName uppercase /> ACADEMY
            </p>
            <figure className="mt-6">
              <blockquote className="text-5xl/[1.05] font-semibold tracking-tight text-balance sm:text-7xl/[1.02]">
                <span aria-hidden="true" className="text-accent">
                  &ldquo;
                </span>
                Forced evolution.
                <span aria-hidden="true" className="text-accent">
                  &rdquo;
                </span>
              </blockquote>
              <figcaption className="mt-5 font-mono text-sm tracking-[0.22em] text-subtle">
                &mdash; J. B. D.
              </figcaption>
            </figure>
            <p className="mt-8 max-w-xl text-lg/8 text-pretty text-muted">{site.description}</p>
            <div className="mt-10">
              <AcademyCta />
            </div>
          </div>

          <ProgressChart />
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Built like a curriculum, not a feed.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.number} className="bg-surface p-7 lg:p-8">
                <p className="font-mono text-xs tracking-[0.2em] text-subtle">{pillar.number}</p>
                <h3 className="mt-5 text-lg font-medium">{pillar.title}</h3>
                <p className="mt-3 text-sm/6 text-muted">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-24">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              See your consistency.
            </h2>
            <p className="mt-5 max-w-md text-base/7 text-muted">
              A daily activity calendar shows when you studied, next to your current rank and how
              far you are from the next one.
            </p>
          </div>
          <ActivityPreview />
        </div>
      </section>
    </>
  );
}

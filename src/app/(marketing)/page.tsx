import Link from "next/link";
import { ProgressChart } from "@/components/marketing/progress-chart";
import { BrandName } from "@/components/site/wordmark";
import { ButtonLink } from "@/components/ui/button";

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

// The Academy lives behind the account, as a tile on the dashboard. So this button takes
// the same road as "Enter the dashboard": a signed-out visitor lands on sign-in (which
// offers "Create an account") and comes back; a signed-in one goes straight through.
function AcademyCta() {
  return (
    <ButtonLink href="/dashboard" size="lg" prefetch={false}>
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
            {/* This is the ZeroCorps page. The Academy is one product under it, below. */}
            <h1 className="text-5xl/[1.05] font-semibold tracking-tight sm:text-7xl/[1.02]">
              <BrandName uppercase />
            </h1>
            <figure className="mt-8 max-w-xl">
              <blockquote className="text-lg/8 text-pretty text-muted">
                <span aria-hidden="true" className="text-accent">
                  &ldquo;
                </span>
                Forced evolution.
                <span aria-hidden="true" className="text-accent">
                  &rdquo;
                </span>
              </blockquote>
              <figcaption className="mt-2 font-mono text-sm tracking-[0.22em] text-subtle">
                &mdash; J.B.
              </figcaption>
            </figure>
            <div className="mt-10">
              <ButtonLink href="/dashboard" size="lg" prefetch={false}>
                Enter the dashboard
                <ArrowRight />
              </ButtonLink>
            </div>
          </div>

          <ProgressChart />
        </div>
      </section>

      {/* The one Academy section on this page. The public page about it is /academy. */}
      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
          <p className="font-mono text-xs tracking-[0.22em] text-accent">ACADEMY</p>
          <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
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
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            <AcademyCta />
            {/* The public page about the Academy: for visitors who cannot sign in yet, and
                so that search engines reach it. */}
            <Link
              href="/academy"
              className="text-sm text-muted underline underline-offset-4 hover:text-fg"
            >
              Learn more<span className="sr-only"> about the Academy</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

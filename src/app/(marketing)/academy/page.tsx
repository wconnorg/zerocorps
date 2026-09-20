import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { BrandName } from "@/components/site/wordmark";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Academy",
  description:
    "Create a ZeroCorps Academy account or sign in to continue your lessons, track your progress and earn ranks.",
  openGraph: { title: site.academy, url: "/academy" },
};

// Placeholder copy throughout: edit freely.

const FEATURES = [
  {
    title: "Lessons in order",
    body: "Courses, modules and lessons in a deliberate sequence, so the next step is never a guess.",
  },
  {
    title: "Ranks from progress",
    body: "Completing lessons moves you up the ranks. Your rank is always calculated from what you have finished.",
  },
  {
    title: "Activity calendar",
    body: "See the days you studied at a glance, and how far you are from your next rank.",
  },
  {
    title: "Discord is optional",
    body: "You never need a site account to use the ZeroCorps Discord. Linking one simply lets your rank appear there as a role.",
  },
];

export default function AcademyLandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow" />

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-24 pb-20 text-center lg:pt-32">
          <p className="font-mono text-xs tracking-[0.22em] text-accent">ACADEMY</p>
          <h1 className="mt-6 text-5xl/[1.05] font-semibold tracking-tight text-balance sm:text-6xl/[1.03]">
            <BrandName /> Academy
          </h1>
          <p className="mt-6 max-w-xl text-lg/8 text-pretty text-muted">
            A structured path from your first chart to a repeatable process. Create an account to
            begin, or sign in to pick up where you left off.
          </p>

          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href="/sign-up" size="lg" className="sm:min-w-40">
              Sign up
            </ButtonLink>
            <ButtonLink href="/sign-in" size="lg" variant="secondary" className="sm:min-w-40">
              Sign in
            </ButtonLink>
          </div>

          <p className="mt-6 text-sm text-subtle">
            Accounts use an email address and a password. You verify your email before you start.
          </p>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="sr-only">What is inside</h2>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="bg-surface p-7 lg:p-8">
                <h3 className="text-lg font-medium">{feature.title}</h3>
                <p className="mt-3 text-sm/6 text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

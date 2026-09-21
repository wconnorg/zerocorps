import { BrandName } from "@/components/site/wordmark";

/**
 * What a signed-in member lands on: a dashboard of tiles, starting with one.
 *
 * The Academy tile says "Coming soon" and is NOT a link (owner, 2026-09-21): there are no
 * lessons until milestone 7, and the public /academy page would ask a signed-in member to
 * sign up. When a second tile arrives (the trading journal, for one) this becomes a grid.
 *
 * It takes plain values and checks nothing, so it can be rendered in a test. The page
 * decides who may see it.
 */
export function DashboardView({ email }: { email: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:py-16">
      <p className="font-mono text-xs tracking-[0.22em] text-subtle">DASHBOARD</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-3 text-sm/6 text-muted">
        Signed in as <span className="text-fg">{email}</span>.
      </p>

      <ul className="mt-10 grid gap-5">
        <li>
          <article
            aria-labelledby="tile-academy"
            className="relative overflow-hidden rounded-2xl border border-line bg-surface p-8 lg:p-10"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hero-glow opacity-60"
            />
            <div className="relative">
              <p className="inline-flex items-center rounded-full border border-line-strong px-3 py-1 font-mono text-[11px] tracking-[0.18em] text-muted">
                COMING SOON
              </p>
              <h2
                id="tile-academy"
                className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                <BrandName /> Academy
              </h2>
              {/* The same line as the public /academy page: no new marketing copy. */}
              <p className="mt-4 max-w-xl text-base/7 text-pretty text-muted">
                A structured path from your first chart to a repeatable process.
              </p>
            </div>
          </article>
        </li>
      </ul>
    </div>
  );
}

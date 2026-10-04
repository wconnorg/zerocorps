import { SecureAccountBanner } from "@/components/app/secure-account-banner";
import { ProductFace, PRODUCTS_IN_ORDER } from "@/components/marketing/products";

/**
 * What a signed-in member lands on: the three ZeroCorps products, one above the other, all
 * the same size (owner, 2026-09-21). They are the products the home page lists, in the
 * same tones, with the Academy first. The words are on the left; at the middle right is one
 * action: the red "Enter here" button on the Academy (it leads to the Academy's page), and
 * "COMING SOON", drawn as a button that cannot be pressed, on ZeroBot and ZeroCharts.
 *
 * `signedInAs` is what to call the member: their `@username`.
 *
 * It takes plain values and checks nothing, so it can be rendered in a test. The page
 * decides who may see it.
 */
export function DashboardView({
  signedInAs,
  linkDiscord = false,
  secureAccountFor = null,
}: {
  signedInAs: string;
  /** Show the "link Discord" card: linking is on and this member has not linked. */
  linkDiscord?: boolean;
  /**
   * This sign-in's session id when the member has no two-factor yet: the banner inviting
   * them to set it up, which they can close for this sign-in. Null: no banner.
   */
  secureAccountFor?: string | null;
}) {
  return (
    <div className="relative">
      {/* A red wash at the top of the page, as on the Academy's pages. Decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 hero-glow"
      />

      <div className="relative mx-auto w-full max-w-3xl px-6 py-12 lg:py-16">
        <h1 className="text-3xl font-light tracking-[0.22em] uppercase">Dashboard</h1>
        <div aria-hidden="true" className="mt-5 h-px w-16 bg-accent" />
        <p className="mt-5 font-mono text-xs tracking-[0.12em] text-subtle">
          Signed in as <span className="text-muted">{signedInAs}</span>
        </p>

        {secureAccountFor ? <SecureAccountBanner sessionId={secureAccountFor} /> : null}

        {linkDiscord ? (
          <div className="mt-8 flex flex-col gap-4 border border-line-strong bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[0.6875rem] tracking-[0.22em] text-accent">DISCORD</p>
              <p className="text-base font-medium">Link your Discord account</p>
              <p className="text-sm/6 text-muted">
                Your Academy rank becomes a role in the ZeroCorps server. It takes a few seconds.
              </p>
            </div>
            {/* A full navigation on purpose: the server answers with a redirect to Discord. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see above */}
            <a
              href="/api/auth/discord/link"
              className="inline-flex h-11 shrink-0 items-center justify-center bg-accent px-5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent/90"
            >
              Link Discord
            </a>
          </div>
        ) : null}

        <ul className="mt-10 grid gap-5">
          {PRODUCTS_IN_ORDER.map((product) => (
            <li key={product.id}>
              <article
                data-tone={product.tone}
                className="product-tile relative flex min-h-44 items-center overflow-hidden border border-line-strong bg-surface p-6 sm:p-8"
              >
                <ProductFace
                  product={product}
                  heading="h2"
                  // A member is already through the door the product's own /dashboard opens.
                  href={product.id === "academy" ? "/academy" : undefined}
                />
              </article>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

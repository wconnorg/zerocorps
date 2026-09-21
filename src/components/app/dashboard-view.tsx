import { ProductFace, PRODUCTS } from "@/components/marketing/products";

/**
 * What a signed-in member lands on: the three ZeroCorps products as tiles (owner,
 * 2026-09-21). The Academy is the prominent one on top; ZeroBot and ZeroCharts sit under
 * it. They are the same tiles as on the home page, in the same tones.
 *
 * Every tile says "COMING SOON" and NONE is a link: there are no lessons until milestone
 * 7, and the public /academy page would ask a signed-in member to sign up.
 *
 * It takes plain values and checks nothing, so it can be rendered in a test. The page
 * decides who may see it.
 */
export function DashboardView({ email }: { email: string }) {
  const academy = PRODUCTS.find((product) => product.id === "academy")!;
  const others = PRODUCTS.filter((product) => product.id !== "academy");
  const tile =
    "product-tile relative flex h-full flex-col justify-between overflow-hidden border border-line-strong bg-surface p-6 sm:p-8";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 lg:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-3 text-sm/6 text-muted">
        Signed in as <span className="text-fg">{email}</span>.
      </p>

      <ul className="mt-10 grid gap-5 sm:grid-cols-2">
        <li className="sm:col-span-2">
          <article data-tone={academy.tone} className={`${tile} min-h-64`}>
            <ProductFace
              product={academy}
              heading="h2"
              linked={false}
              watermark={false}
              comingSoon
            />
            <div aria-hidden="true" className="h-4" />
          </article>
        </li>
        {others.map((product) => (
          <li key={product.id}>
            <article data-tone={product.tone} className={`${tile} min-h-56`}>
              <ProductFace
                product={product}
                heading="h2"
                linked={false}
                watermark={false}
                comingSoon
              />
              <div aria-hidden="true" className="h-4" />
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

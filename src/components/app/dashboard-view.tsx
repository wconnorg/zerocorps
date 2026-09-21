import { ProductFace, PRODUCTS } from "@/components/marketing/products";

/**
 * What a signed-in member lands on: the three ZeroCorps products, one above the other, all
 * the same size (owner, 2026-09-21). They are the same tiles as on the home page, in the
 * same tones, with the Academy first. The words are on the left; at the middle right is one
 * action: the red "Enter here" button on the Academy (it leads to the Academy's page, which
 * says it is coming soon), and "COMING SOON", drawn as a button that cannot be pressed, on
 * ZeroBot and ZeroCharts.
 *
 * `signedInAs` is what to call the member: their `@username`.
 *
 * It takes plain values and checks nothing, so it can be rendered in a test. The page
 * decides who may see it.
 */
export function DashboardView({ signedInAs }: { signedInAs: string }) {
  const ordered = [
    ...PRODUCTS.filter((product) => product.id === "academy"),
    ...PRODUCTS.filter((product) => product.id !== "academy"),
  ];

  return (
    <div className="relative">
      {/* The same red wash as the home page's hero. Decorative. */}
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

        <ul className="mt-10 grid gap-5">
          {ordered.map((product) => (
            <li key={product.id}>
              <article
                data-tone={product.tone}
                className="product-tile relative flex min-h-44 items-center overflow-hidden border border-line-strong bg-surface p-6 sm:p-8"
              >
                <ProductFace
                  product={product}
                  heading="h2"
                  watermark={false}
                  layout="row"
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

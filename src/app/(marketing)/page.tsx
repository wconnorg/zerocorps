import { ProductWheel } from "@/components/marketing/product-wheel";
import { ProductFace, PRODUCTS } from "@/components/marketing/products";
import { BrandName } from "@/components/site/wordmark";
import { ButtonLink } from "@/components/ui/button";

// Placeholder copy throughout: edit freely.

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

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-20 pb-24 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-28 lg:pb-32">
          <div>
            {/* This is the ZeroCorps page. Its products are on the wheel and in the section below. */}
            <h1 className="text-5xl/[1.05] font-semibold tracking-tight sm:text-7xl/[1.02]">
              <BrandName uppercase />
            </h1>
            <figure className="mt-8 max-w-xl">
              <blockquote className="text-2xl/9 text-pretty text-muted sm:text-3xl/10">
                <span aria-hidden="true" className="text-fg">
                  &ldquo;
                </span>
                Forced evolution.
                <span aria-hidden="true" className="text-fg">
                  &rdquo;
                </span>
              </blockquote>
              <figcaption className="mt-3 font-mono text-base tracking-[0.22em] text-subtle sm:text-lg">
                &mdash; J.B.
              </figcaption>
            </figure>
            <div className="mt-10">
              {/* Not pre-loaded: a signed-out visitor's browser would be redirected and abort. */}
              <ButtonLink href="/dashboard" size="lg" prefetch={false}>
                Enter the dashboard
                <ArrowRight />
              </ButtonLink>
            </div>
          </div>

          <ProductWheel />
        </div>
      </section>

      {/*
        The three products, side by side (owner, 2026-09-21): the Academy is one of three.
        The tiles are the same ones the wheel turns. ZeroBot and ZeroCharts say "coming
        soon"; the Academy tile leads to its public page.
      */}
      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
          <h2 className="font-mono text-xs font-normal tracking-[0.22em] text-accent">PRODUCTS</h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {PRODUCTS.map((product) => (
              <li key={product.id}>
                <article
                  data-tone={product.tone}
                  className="product-tile relative flex h-full min-h-72 flex-col justify-between overflow-hidden border border-line-strong bg-surface p-6 sm:p-7"
                >
                  <ProductFace product={product} heading="h3" watermark={false} />
                  <div aria-hidden="true" className="h-4" />
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

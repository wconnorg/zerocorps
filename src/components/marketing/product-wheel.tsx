"use client";

import { useState } from "react";
import { nameOf, ProductFace, PRODUCTS } from "./products";

/**
 * The turning wheel of ZeroCorps products in the home page's hero (owner, 2026-09-21).
 *
 * Three monolith tiles (see `products.tsx` for their face). The one in front is lit; the
 * two behind it stand to either side, turned away and dimmed. All three are always in the
 * page, so nothing is hidden from a screen reader.
 *
 * The wheel turns by itself, slowly. Its timer is an invisible element with an 8-second
 * CSS animation: the wheel turns when that animation ends. So there is no interval to keep
 * in step. Pausing the animation (the pointer or the keyboard focus resting on the wheel,
 * or the pause button) pauses the wheel exactly where it was; a background tab stops it;
 * and a visitor who asked for reduced motion gets no animation, so the wheel never turns
 * by itself. No library: a tile's place is one `data-pos` attribute, and `globals.css`
 * does the rest.
 *
 * Nothing is drawn under the wheel (owner): a tile at the side comes to the front when it
 * is clicked. The click is caught by two invisible zones over the wheel's left and right,
 * outside the 3D space: a tile at the side stands BEHIND the wheel's own plane, where the
 * browser gives the click to the wheel instead of the tile. They are for the pointer only.
 * The previous, next, pick-one and pause buttons are still there for the
 * keyboard and for screen readers, hidden until one of them has the focus, because
 * anything that moves by itself must be possible to stop.
 *
 * The first render is always the same (the Academy in front), so the page stays static.
 */

const COUNT = PRODUCTS.length;
const START_WITH = 2; // the Academy

const controlClasses =
  "inline-flex size-9 items-center justify-center text-muted transition-colors hover:bg-raised hover:text-fg";

function Icon({ path }: { path: string }) {
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
      <path d={path} />
    </svg>
  );
}

export function ProductWheel() {
  const [active, setActive] = useState(START_WITH);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);

  const turn = (by: number) => setActive((value) => (value + by + COUNT) % COUNT);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="ZeroCorps products"
      className="w-full"
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false);
      }}
    >
      <div className="relative mx-auto w-full max-w-xl">
        <div className="wheel relative w-full">
          {PRODUCTS.map((product, index) => {
            const front = index === active;
            return (
              <article
                key={product.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${COUNT}: ${nameOf(product)}`}
                data-pos={(index - active + COUNT) % COUNT}
                data-tone={product.tone}
                className="product-tile wheel-tile flex flex-col justify-between overflow-hidden border border-line-strong bg-surface p-5 shadow-2xl sm:p-7"
              >
                <ProductFace product={product} heading="h2" linked={front} />
                {/* Keeps the name in the middle of the tile; the top row is its counterweight. */}
                <div aria-hidden="true" className="h-4" />
              </article>
            );
          })}

          {/* The timer. A new element for every turn, so it always counts from the start. */}
          <span
            key={active}
            aria-hidden="true"
            data-paused={paused || holding}
            onAnimationEnd={() => turn(1)}
            className="wheel-timer"
          />
        </div>

        {/* Pointer only: the keyboard and screen readers have the buttons below. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => turn(-1)}
          className="wheel-hit wheel-hit-left"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => turn(1)}
          className="wheel-hit wheel-hit-right"
        />
      </div>

      <div className="sr-only relative z-10 items-center justify-center gap-1 focus-within:not-sr-only focus-within:mt-4 focus-within:flex">
        <button
          type="button"
          aria-label="Previous product"
          onClick={() => turn(-1)}
          className={controlClasses}
        >
          <Icon path="M10 3 5 8l5 5" />
        </button>
        {PRODUCTS.map((product, index) => (
          <button
            key={product.id}
            type="button"
            aria-label={`Show ${nameOf(product)}`}
            aria-current={index === active ? "true" : undefined}
            onClick={() => setActive(index)}
            className="group inline-flex h-7 w-8 items-center justify-center"
          >
            <span className="h-0.5 w-6 bg-line-strong transition-colors group-hover:bg-muted group-aria-[current=true]:bg-accent" />
          </button>
        ))}
        <button
          type="button"
          aria-label="Next product"
          onClick={() => turn(1)}
          className={controlClasses}
        >
          <Icon path="m6 3 5 5-5 5" />
        </button>
        <button
          type="button"
          aria-label={paused ? "Start the wheel turning" : "Pause the wheel"}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
          className={controlClasses}
        >
          <Icon path={paused ? "M5 3.5v9l7-4.5-7-4.5Z" : "M5.5 3.5v9M10.5 3.5v9"} />
        </button>
      </div>
    </div>
  );
}

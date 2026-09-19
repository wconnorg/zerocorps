/**
 * Hero illustration: rank rising as lessons are completed.
 *
 * This is decoration, not data. It is hidden from assistive technology and has
 * no tooltip or table view because there are no real values behind it. The real
 * progress views arrive with the academy milestone.
 */

const WIDTH = 560;
const HEIGHT = 300;
const STEP = 40;

// Lower y is higher on screen. Uneven on purpose: progress has dips and plateaus.
const LEVELS = [262, 250, 256, 228, 236, 204, 214, 176, 190, 150, 162, 120, 132, 96, 70];
const POINTS = LEVELS.map((y, index) => ({ x: index * STEP, y }));

const LINE = POINTS.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(
  " ",
);
const AREA = `${LINE} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;

const RANK_MARKERS = [
  { index: 3, label: "RANK 01" },
  { index: 7, label: "RANK 02" },
  { index: 11, label: "RANK 03" },
];
const LAST = POINTS[POINTS.length - 1]!;

/** Position in the SVG's coordinate space, as a percentage of the wrapper. */
const percent = (value: number, total: number) => `${(value / total) * 100}%`;

export function ProgressChart() {
  return (
    <div
      aria-hidden="true"
      className="min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6 light:shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between font-mono text-[11px] tracking-[0.18em] text-subtle">
        <span>PROGRESS</span>
        <span>PREVIEW</span>
      </div>

      {/*
        Labels are HTML laid over the SVG rather than SVG <text>, which would
        shrink with the drawing and become unreadable on a phone. The wrapper has
        the SVG's exact aspect ratio, so percentages map onto its coordinates.
      */}
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full overflow-visible">
          <defs>
            <linearGradient id="progress-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Recessive grid */}
          {/* `vector-effect` is not inherited, so it is set on each line. */}
          <g stroke="var(--line)" strokeWidth="1">
            {[60, 120, 180, 240].map((y) => (
              <line
                key={`h${y}`}
                x1="0"
                x2={WIDTH}
                y1={y}
                y2={y}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {[80, 160, 240, 320, 400, 480].map((x) => (
              <line
                key={`v${x}`}
                x1={x}
                x2={x}
                y1="0"
                y2={HEIGHT}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>

          {/* The next rank, as a threshold to reach */}
          <line
            x1="0"
            x2={WIDTH}
            y1={LAST.y}
            y2={LAST.y}
            stroke="var(--line-strong)"
            strokeWidth="1"
            strokeDasharray="4 6"
            vectorEffect="non-scaling-stroke"
          />

          <path d={AREA} fill="url(#progress-area)" />
          <path
            d={LINE}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "var(--chart-glow)" }}
          />

          {/* Rank markers, ringed in the surface colour so they sit on the line */}
          {RANK_MARKERS.map(({ index, label }) => {
            const point = POINTS[index]!;
            return (
              <circle
                key={label}
                cx={point.x}
                cy={point.y}
                r="5"
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
            );
          })}

          {/* Where you are now */}
          <circle
            cx={LAST.x}
            cy={LAST.y}
            r="5"
            fill="var(--accent)"
            opacity="0.5"
            className="motion-safe:animate-ping"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
          <circle
            cx={LAST.x}
            cy={LAST.y}
            r="5"
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        </svg>

        {/* Labels wear text ink, never the line's colour */}
        <span
          className="absolute left-0 -translate-y-full pb-1.5 font-mono text-[10px] tracking-[0.16em] text-subtle"
          style={{ top: percent(LAST.y, HEIGHT) }}
        >
          NEXT RANK
        </span>
        {RANK_MARKERS.map(({ index, label }) => {
          const point = POINTS[index]!;
          return (
            <span
              key={label}
              className="absolute hidden -translate-x-1/2 -translate-y-full pb-3 font-mono text-[10px] tracking-[0.16em] whitespace-nowrap text-muted sm:block"
              style={{ left: percent(point.x, WIDTH), top: percent(point.y, HEIGHT) }}
            >
              {label}
            </span>
          );
        })}
      </div>

      <div className="mt-4 font-mono text-[11px] tracking-[0.18em] text-subtle">
        LESSONS COMPLETED →
      </div>
    </div>
  );
}

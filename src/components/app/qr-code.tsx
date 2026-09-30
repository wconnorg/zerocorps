import { encode } from "uqr";

/**
 * A QR code, drawn here as one SVG path: nothing is fetched and no image service ever sees
 * what it holds (for two-factor set-up, the app's secret). Scanners want dark on light, so
 * the panel always wears the light theme's white surface and near-black text, whatever the
 * page's theme.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = encode(value, { ecc: "M", border: 0 });
  let path = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    // The padding is the quiet zone scanners need around the code (about four modules).
    <div data-theme="light" className="inline-block rounded-xl bg-surface p-5 text-fg">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        className="size-48 sm:size-52"
      >
        <path d={path} fill="currentColor" />
      </svg>
    </div>
  );
}

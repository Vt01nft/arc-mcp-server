/**
 * Arc mark: an arch with its two footing dots, plus a double dot beneath.
 * Everything lives in one `.arc-anim` element so the whole mark bounces
 * together. Color follows `--accent` (currentColor).
 */
export function ArcLogo({ size = 40 }: { size?: number }) {
  return (
    <span
      className="arc-anim"
      aria-hidden="true"
      style={{ display: "inline-flex", color: "var(--accent)", flexShrink: 0 }}
    >
      <svg
        width={size}
        height={size * 1.25}
        viewBox="0 0 32 40"
        fill="none"
      >
        {/* arch */}
        <path
          d="M4 22 A 12 12 0 0 1 28 22"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        {/* arch footings */}
        <circle cx="4" cy="22" r="2.6" fill="currentColor" />
        <circle cx="28" cy="22" r="2.6" fill="currentColor" />
        {/* double dot beneath */}
        <circle cx="11" cy="33" r="2.4" fill="currentColor" />
        <circle cx="21" cy="33" r="2.4" fill="currentColor" />
      </svg>
    </span>
  );
}

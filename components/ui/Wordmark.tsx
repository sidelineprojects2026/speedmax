/**
 * Speedmax wordmark.
 *
 * The mark is a hull section cut by a forward chevron — a shipping silhouette
 * that still reads at 24px in the portal sidebar. §28 D-01 leaves official
 * branding to the Executive Sponsor, so this is a considered placeholder built
 * from the same tokens as everything else; replacing it later touches this file
 * only.
 */
export function Wordmark({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        role="img"
        aria-label="Speedmax"
      >
        <rect width="32" height="32" rx="3" className="fill-beacon-500" />
        {/* Hull line */}
        <path
          d="M5 21h22l-3.5 5.5H8.5L5 21Z"
          className="fill-white"
          opacity="0.95"
        />
        {/* Forward chevrons — motion, and the containers stacked above deck */}
        <path d="M11 6.5 18 13l-7 6.5V15l2.8-2-2.8-2V6.5Z" className="fill-white" />
        <path
          d="M18.5 6.5 25.5 13l-7 6.5V15l2.8-2-2.8-2V6.5Z"
          className="fill-white"
          opacity="0.55"
        />
      </svg>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-bold tracking-[0.14em]">SPEEDMAX</span>
          <span className="mt-1 text-[10px] font-medium tracking-[0.22em] text-steel-300">
            CARGO SOLUTIONS
          </span>
        </span>
      )}
    </span>
  );
}

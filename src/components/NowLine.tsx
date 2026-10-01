import { useNow } from "@/hooks/useNow";

// Current-time marker in today's column; re-renders once a minute. Drawn in
// `--foreground`, not `--primary`: the blocks are tints of `--primary`, so a
// red line vanished where it crossed one and the block looked cut. The dot at
// the column's left edge marks it as the time, not a block border.
export function NowLine({ firstHour, lastHour }: { firstHour: number; lastHour: number }) {
  const now = useNow();

  const minutes = now.getHours() * 60 + now.getMinutes() - firstHour * 60;
  const total = (lastHour - firstHour) * 60;
  if (minutes < 0 || minutes > total) return null;

  return (
    <div
      aria-hidden
      className="absolute inset-x-0 z-10 h-0.5 -translate-y-1/2 bg-foreground"
      style={{ top: `${(minutes / total) * 100}%` }}
    >
      <div className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rounded-full bg-foreground" />
    </div>
  );
}

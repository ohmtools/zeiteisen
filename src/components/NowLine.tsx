import { useNow } from "@/hooks/useNow";

// Current-time marker in today's column; re-renders once a minute. Red, the
// one accent (blocks are coloured by kind, none of them red). The dot at the
// column's left edge marks it as the time, not a block border; it pulses
// softly and the line glides on with the minute.
export function NowLine({ firstHour, lastHour }: { firstHour: number; lastHour: number }) {
  const now = useNow();

  const minutes = now.getHours() * 60 + now.getMinutes() - firstHour * 60;
  const total = (lastHour - firstHour) * 60;
  if (minutes < 0 || minutes > total) return null;

  return (
    <div
      aria-hidden
      className="absolute inset-x-0 z-10 h-0.5 -translate-y-1/2 bg-destructive transition-[top] duration-1000 ease-linear"
      style={{ top: `${(minutes / total) * 100}%` }}
    >
      {/* The dot breathes, slowly: the line is live, not a border. */}
      <div className="absolute top-1/2 -left-1 size-2 -translate-y-1/2">
        <span className="absolute inset-0 animate-ping rounded-full bg-destructive/60 [animation-duration:2.4s]" />
        <span className="absolute inset-0 rounded-full bg-destructive" />
      </div>
    </div>
  );
}

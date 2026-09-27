import { useNow } from "@/hooks/useNow";

// Current-time marker in today's column; re-renders once a minute.
export function NowLine({ firstHour, lastHour }: { firstHour: number; lastHour: number }) {
  const now = useNow();

  const minutes = now.getHours() * 60 + now.getMinutes() - firstHour * 60;
  const total = (lastHour - firstHour) * 60;
  if (minutes < 0 || minutes > total) return null;

  return (
    <div
      className="absolute inset-x-0 z-10 border-t-2 border-primary"
      style={{ top: `${(minutes / total) * 100}%` }}
    />
  );
}

import { useEffect, useState } from "react";

// The current time, refreshed every `every` ms. A `new Date()` in render
// would be cached by the React Compiler (it has no inputs), so anything that
// shows "now" or "today" reads it from here; a page left open overnight
// moves on by itself.
export function useNow(every = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), every);
    return () => clearInterval(timer);
  }, [every]);

  return now;
}

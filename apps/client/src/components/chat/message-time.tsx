import { useState, useEffect } from "react";

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;

  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins}m ago`;
  }
  if (diff < 86_400_000) {
    const hours = Math.floor(diff / 3_600_000);
    return `${hours}h ago`;
  }

  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageTime({ timestamp }: { timestamp: number | undefined }) {
  const [display, setDisplay] = useState(() => (timestamp ? formatTime(timestamp) : ""));

  useEffect(() => {
    if (!timestamp) return;
    setDisplay(formatTime(timestamp));
    const id = setInterval(() => setDisplay(formatTime(timestamp)), 30_000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (!timestamp) return null;

  return <span className="text-[11px] text-muted-foreground/40">{display}</span>;
}

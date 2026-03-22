import { useState, useEffect, useRef } from "react";
import spinners from "cli-spinners";

const spinner = spinners.dots;

export function ThinkingIndicator({ label }: { label?: string }) {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    startTime.current = Date.now();

    const spinnerTimer = setInterval(() => {
      setFrame((f) => (f + 1) % spinner.frames.length);
    }, spinner.interval);

    const elapsedTimer = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 10);

    return () => {
      clearInterval(spinnerTimer);
      clearInterval(elapsedTimer);
    };
  }, []);

  const seconds = (elapsed / 1000).toFixed(2);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="inline-block w-4 text-center font-mono">{spinner.frames[frame]}</span>
      {label ? <span>{label}</span> : <span className="tabular-nums">{seconds}s</span>}
    </div>
  );
}

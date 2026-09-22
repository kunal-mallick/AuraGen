"use client";

import { useMouseTelemetry } from "@/useMouseTelemetry";

export default function Home() {
  const { velocity, hesitationDuration } = useMouseTelemetry();

  return (
    <main>
      <div>
        <h2>Mouse Velocity</h2>
        <p>{velocity.toFixed(0)}</p>
      </div>
      <div>
        <h2>Hesitation</h2>
        <p>{hesitationDuration.toFixed(0)} ms</p>
      </div>
    </main>
  );
}
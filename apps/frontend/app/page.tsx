"use client";

import { useMouseTelemetry } from "../hooks/useMouseTelemetry";
import { DynamicRenderer } from "../components/dynamic-ui/DynamicRenderer";
import DynamicCodeRenderer from "../components/dynamic-ui/DynamicCodeRenderer";
const generatedCode = `
function GeneratedComponent(props) {
  return (
    <div>
      <h2>Generated UI</h2>
      <p>{props.message}</p>
    </div>
  );
}
`;

export default function Home() {
  const { velocity, hesitationDuration } = useMouseTelemetry();

  return (
    <main>
      <h1>Telemetry Tracker</h1>
      <DynamicRenderer />
      <DynamicCodeRenderer
  code={generatedCode}
  componentProps={{ message: "Dynamic injection is working!" }}
/>

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
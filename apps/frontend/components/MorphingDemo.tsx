"use client";

import React, { useState } from "react";
import MorphingUI from "./MorphingUI";
import DynamicCodeRenderer from "./dynamic-ui/DynamicCodeRenderer";

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
export default function MorphingDemo() {
  const [isGenerated, setIsGenerated] = useState(false);

  return (
    <section>
      <h2>Week 3 Morphing Animation</h2>

      <button onClick={() => setIsGenerated((value) => !value)}>
        {isGenerated ? "Show Static UI" : "Show Generated UI"}
      </button>
      <MorphingUI isGenerated={isGenerated}>
        {isGenerated ? (
          <DynamicCodeRenderer
            code={generatedCode}
            componentProps={{
              message: "Smooth morphing to generated UI!",
            }}
          />
        ) : (
          <div>
            <h3>Static UI</h3>
            <p>This is the original static interface.</p>
          </div>
        )}
      </MorphingUI>
    </section>
  );
}
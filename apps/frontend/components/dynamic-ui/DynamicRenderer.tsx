"use client";
import { useDynamicComponent } from "../../hooks/useDynamicComponent";
import { GeneratedUI } from "./GeneratedUI";

export function DynamicRenderer() {
  const { componentKey, componentProps, setComponent } = useDynamicComponent("card");

  return (
    <section>
      <h2>Dynamic Renderer</h2>
      <p style={{ opacity: 0.7, fontSize: 14 }}>
        Simulates the backend handing off a newly generated component.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        <button onClick={() => setComponent("card", { title: "Generated Card" })}>
          Load Card
        </button>
        <button onClick={() => setComponent("banner", { message: "Generated Banner" })}>
          Load Banner
        </button>
      </div>

      {componentKey && (
        <GeneratedUI componentKey={componentKey} componentProps={componentProps} />
      )}
    </section>
  );
}

export default DynamicRenderer;
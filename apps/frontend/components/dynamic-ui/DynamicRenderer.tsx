"use client";
import { useDynamicComponent } from "../../hooks/useDynamicComponent";
import { GeneratedUI } from "./GeneratedUI";
import FallbackUI from "./FallbackUI";

export function DynamicRenderer() {
 const {
  componentKey,
  componentProps,
  setComponent,
  clearComponent,
} = useDynamicComponent("card");
<button onClick={clearComponent}>
  Clear Component
</button>
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
        <button onClick={clearComponent}>
  Clear Component
</button>
      </div>

      {componentKey ? (
  <GeneratedUI
    componentKey={componentKey}
    componentProps={componentProps}
  />
) : (
  <FallbackUI
    variant="error"
    message="Unable to load the generated component."
  />
)}
    </section>
  );
}

export default DynamicRenderer;
export function FallbackUI({ variant = "loading" }: { variant?: "loading" | "error"; message?: string }) {
  if (variant === "error") {
    return (
      <div
        style={{
          padding: "1rem",
          border: "1px solid #e5484d",
          borderRadius: 8,
          color: "#e5484d",
          fontSize: 14,
        }}
      >
        Couldn&apos;t load this component.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "1rem",
        border: "1px dashed #888",
        borderRadius: 8,
        opacity: 0.6,
        fontSize: 14,
      }}
    >
      Generating component…
    </div>
  );
}

export default FallbackUI;
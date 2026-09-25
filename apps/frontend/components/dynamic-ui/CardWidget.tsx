export default function CardWidget({ title = "Generated Card" }: { title?: string }) {
  return (
    <div
      style={{
        padding: "1.25rem",
        borderRadius: 12,
        border: "1px solid #333",
        background: "#111",
        color: "#eee",
        maxWidth: 320,
      }}
    >
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p style={{ opacity: 0.7, fontSize: 14, marginTop: 8 }}>
        This component was injected dynamically via Suspense — no page
        refresh happened when it appeared.
      </p>
    </div>
  );
}
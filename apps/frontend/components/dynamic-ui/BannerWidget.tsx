export default function BannerWidget({ message = "Generated Banner" }: { message?: string }) {
  return (
    <div
      style={{
        padding: "0.9rem 1.25rem",
        borderRadius: 8,
        background: "linear-gradient(90deg, #5B8CFF, #7A5BFF)",
        color: "#fff",
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  );
}
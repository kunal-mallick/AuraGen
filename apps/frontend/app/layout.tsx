import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AuraGen",
  description: "AuraGen frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
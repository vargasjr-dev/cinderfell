import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cinderling Game",
  description: "A multiplayer RPG game where you battle with your army of cinderlings",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

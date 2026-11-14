import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetTrack",
  description: "Track LeetCode attempts, reviews, and pattern mastery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

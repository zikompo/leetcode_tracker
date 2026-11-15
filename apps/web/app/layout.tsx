import type { Metadata } from "next";
import localFont from "next/font/local";
import { TooltipProvider } from "@leettrack/ui/components/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LeetTrack", template: "%s · LeetTrack" },
  description: "Track LeetCode attempts, reviews, and pattern mastery.",
};

// Geist, self-hosted from @fontsource-variable (Latin; system fonts cover anything else).
const geistSans = localFont({
  src: "../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = localFont({
  src: "../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
});

/** Before first paint: the saved theme, else the system's. Dark when unknown. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("leettrack-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}

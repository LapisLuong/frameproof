import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Masthead } from "@/components/Masthead";
import { ToastHost } from "@/components/Toast";
import "./globals.css";

const beVietnam = localFont({
  src: [
    { path: "./fonts/BeVietnamPro-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/BeVietnamPro-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/BeVietnamPro-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/BeVietnamPro-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-be-vietnam",
  display: "swap",
});

const lora = localFont({
  src: [
    { path: "./fonts/Lora-Variable.ttf", weight: "400 700", style: "normal" },
    { path: "./fonts/Lora-Italic-Variable.ttf", weight: "400 700", style: "italic" },
  ],
  variable: "--font-lora",
  display: "swap",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "FrameProof", template: "%s — FrameProof" },
  description: "A creative direction and visual quality workspace. Design with intention.",
};

export const viewport: Viewport = { themeColor: "#f6f4ef" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${beVietnam.variable} ${lora.variable} ${plexMono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Masthead />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <ToastHost />
      </body>
    </html>
  );
}

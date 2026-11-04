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

/* Poster families for artwork only (src/lib/design/fonts.ts). Not preloaded: a page downloads them only when a
   design on it uses them. Sources and hashes: src/app/fonts/SOURCES.md. */
const anton = localFont({ src: "./fonts/Anton-Regular.ttf", weight: "400", variable: "--font-anton", display: "swap", preload: false });
const archivo = localFont({
  src: [
    { path: "./fonts/Archivo-Variable.ttf", weight: "100 900", style: "normal" },
    { path: "./fonts/Archivo-Italic-Variable.ttf", weight: "100 900", style: "italic" },
  ],
  variable: "--font-archivo",
  display: "swap",
  preload: false,
});
const fraunces = localFont({
  src: [
    { path: "./fonts/Fraunces-Variable.ttf", weight: "100 900", style: "normal" },
    { path: "./fonts/Fraunces-Italic-Variable.ttf", weight: "100 900", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
  preload: false,
});
const playfair = localFont({
  src: [
    { path: "./fonts/PlayfairDisplay-Variable.ttf", weight: "400 900", style: "normal" },
    { path: "./fonts/PlayfairDisplay-Italic-Variable.ttf", weight: "400 900", style: "italic" },
  ],
  variable: "--font-playfair",
  display: "swap",
  preload: false,
});

const oswald = localFont({ src: "./fonts/Oswald-Variable.ttf", weight: "200 700", variable: "--font-oswald", display: "swap", preload: false });
const barlowCondensed = localFont({
  src: [
    { path: "./fonts/BarlowCondensed-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/BarlowCondensed-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/BarlowCondensed-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/BarlowCondensed-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
  preload: false,
});
const bungee = localFont({ src: "./fonts/Bungee-Regular.ttf", weight: "400", variable: "--font-bungee", display: "swap", preload: false });
const spaceGrotesk = localFont({ src: "./fonts/SpaceGrotesk-Variable.ttf", weight: "300 700", variable: "--font-space-grotesk", display: "swap", preload: false });
const unbounded = localFont({ src: "./fonts/Unbounded-Variable.ttf", weight: "200 900", variable: "--font-unbounded", display: "swap", preload: false });
const dancingScript = localFont({ src: "./fonts/DancingScript-Variable.ttf", weight: "400 700", variable: "--font-dancing-script", display: "swap", preload: false });
const artworkFonts = [anton, archivo, fraunces, playfair, oswald, barlowCondensed, bungee, spaceGrotesk, unbounded, dancingScript];

export const metadata: Metadata = {
  title: { default: "FrameProof", template: "%s — FrameProof" },
  description: "A creative direction and visual quality workspace. Design with intention.",
};

export const viewport: Viewport = { themeColor: "#f6f4ef" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${beVietnam.variable} ${lora.variable} ${plexMono.variable} ${artworkFonts.map((f) => f.variable).join(" ")}`}>
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

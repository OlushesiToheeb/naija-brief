import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";

// Clash Display — the wordmark, headlines and section titles (self-hosted).
const display = localFont({
  variable: "--font-clash",
  display: "swap",
  src: [
    { path: "./fonts/ClashDisplay-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ClashDisplay-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ClashDisplay-700.woff2", weight: "700", style: "normal" },
  ],
});

// General Sans — body, UI and labels.
const body = localFont({
  variable: "--font-general",
  display: "swap",
  src: [
    { path: "./fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Naija Brief — your morning news, read aloud",
  description:
    "Your Nigeria-first morning news briefing — read aloud across politics, tech, business, markets, sport and the world.",
  applicationName: "Naija Brief",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Naija Brief",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c5c3e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

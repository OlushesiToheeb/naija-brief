import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Newsreader,
  Spline_Sans_Mono,
} from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "../components/ServiceWorkerRegister";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

const body = Newsreader({
  variable: "--font-body",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const mono = Spline_Sans_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
  themeColor: "#0d2b1d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

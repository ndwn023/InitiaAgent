import type { Metadata, Viewport } from "next";
import { WalletProvider } from "@/components/providers/WalletProvider";
import { Inter, JetBrains_Mono, Manrope, Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Load only essential fonts with tightly scoped weights to minimise FOUT & payload
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  // Only load weights actually used in the app
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

// Viewport export — tells Next.js to render the <meta name="viewport"> tag
// correctly and enables theme-color (used by mobile browsers for chrome color)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7b39fc",
};

export const metadata: Metadata = {
  title: {
    default: "InitiaAgent",
    template: "%s | InitiaAgent",
  },
  description: "AI-Powered DeFi Trading Agent Platform on Initia Blockchain",
  keywords: ["DeFi", "AI agent", "Initia", "blockchain", "trading", "Web3", "non-custodial"],
  authors: [{ name: "InitiaAgent" }],
  icons: {
    icon: [
      { url: "/logo-mark.svg", type: "image/svg+xml" },
      { url: "/logo-mark.svg", sizes: "any" },
    ],
    apple: "/logo-mark.svg",
  },
  openGraph: {
    title: "InitiaAgent — AI-Powered DeFi Agents",
    description: "Deploy autonomous AI trading agents on the Initia blockchain. Non-custodial, 24/7, fully on-chain.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "InitiaAgent — AI-Powered DeFi Agents",
    description: "Deploy autonomous AI trading agents on the Initia blockchain.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${manrope.variable} ${instrumentSerif.variable} dark`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased text-zinc-50" style={{ background: "#010101" }}>
        <WalletProvider>{children}</WalletProvider>
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  );
}

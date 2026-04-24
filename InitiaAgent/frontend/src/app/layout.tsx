import { WalletProvider } from "@/components/providers/WalletProvider";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  title: "InitiaAgent",
  description: "AI-Powered DeFi Trading Agent Platform on Initia Blockchain",
  icons: {
    icon: "https://raw.githubusercontent.com/initia-labs/initia-registry/main/images/INIT.png",
    apple:
      "https://raw.githubusercontent.com/initia-labs/initia-registry/main/images/INIT.png",
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
      className={`${inter.variable} ${jetbrainsMono.variable} dark`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-[#08080a] text-zinc-50">
        <WalletProvider>{children}</WalletProvider>
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  );
}

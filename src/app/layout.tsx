import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BottomNavigation from "@/components/BottomNavigation";
import { FarcasterProvider } from "@/components/providers/FarcasterProvider";
import { TransactionProvider } from "@/components/providers/TransactionProvider";
import { HapticProvider } from "@/providers/HapticProvider";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clanker Tools",
  description: "Your comprehensive platform for Clanker token management",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-hidden`}
      >
        <FarcasterProvider>
          <HapticProvider>
            <TransactionProvider>
              <WebSocketProvider>
                <div className="flex h-screen flex-col overflow-hidden">
                  <header className="flex items-center justify-between p-3 bg-background shrink-0">
                    <h1 className="text-lg font-bold truncate">Clanker Tools</h1>
                  </header>
                  <main className="flex-1 overflow-y-auto overflow-x-hidden -webkit-overflow-scrolling-touch">{children}</main>
                  <BottomNavigation />
                </div>
              </WebSocketProvider>
            </TransactionProvider>
          </HapticProvider>
        </FarcasterProvider>
      </body>
    </html>
  );
}

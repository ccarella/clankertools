import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Menu } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { FarcasterProvider } from "@/components/providers/FarcasterProvider";
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
  width: 424,
  height: 695,
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
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <FarcasterProvider>
          <div className="flex min-h-screen flex-col">
            <header className="flex items-center justify-between p-4 bg-background">
              <h1 className="text-xl font-bold">Clanker Tools</h1>
              <button className="p-2 rounded-lg bg-muted/20">
                <Menu size={24} className="text-foreground" />
              </button>
            </header>
            <main className="flex-1 overflow-auto">{children}</main>
            <BottomNavigation />
          </div>
        </FarcasterProvider>
      </body>
    </html>
  );
}

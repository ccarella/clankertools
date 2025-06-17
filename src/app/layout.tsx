import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import SidebarMenu from "@/components/SidebarMenu";
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground safe-area-inset`}
      >
        <FarcasterProvider>
          <SidebarMenu />
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
        </FarcasterProvider>
      </body>
    </html>
  );
}

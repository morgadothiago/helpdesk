import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionHeader } from "@/components/session-header";
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
  title: "Helpdesk",
  description: "Helpdesk - painel web",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionHeader />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}

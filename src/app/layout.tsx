// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AuthSessionProvider from "@/providers/AuthSessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "가계부 앱",
  description: "Next.js와 SQLite로 만든 간단한 가계부 애플리케이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <body
        className={`${inter.className} bg-gray-50  text-gray-900  min-h-screen transition-colors duration-300`}
      >
        <AuthSessionProvider>
          <ToastProvider>
            <main className="container mx-auto p-4">{children}</main>
            <Analytics />
            <SpeedInsights />
          </ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

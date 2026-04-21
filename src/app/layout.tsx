import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ClientLayout } from "./client-layout";

// NexVision brand typography — Roboto (per brand book)
const roboto = Roboto({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NexHRMS — Human Resource Management System",
  description: "Modern, high-performance SaaS HRMS application built with Next.js",
  appleWebApp: {
    title: "NexHRMS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${roboto.variable} ${robotoMono.variable} font-sans antialiased`}
      >
        <ClientLayout>{children}</ClientLayout>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
